/**
 * Live-Postgres coverage for the staff-auth path added to replace apps/
 * dashboard's raw-API-key-paste login: TenantStaffService (the invite/list
 * write side of TenantStaffMembership) and TenantActorGuard (the guard
 * apps/dashboard's case list/read/resolve routes now sit behind — a
 * strict superset of ApiKeyGuard that also accepts a real staff Account
 * session). Same live-Postgres, RUN_DB_TESTS-gated, direct-instantiation
 * approach as accounts.service.spec.ts / oauth.service.spec.ts.
 *
 *   RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@nid/db';
import { generateApiKey, generateSessionToken, hashApiKey, sha256Hex } from '@nid/shared-types';
import { PrismaService } from '../src/core/db/prisma.service';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { TenantActorGuard } from '../src/core/auth/tenant-actor.guard';
import { TenantStaffService } from '../src/modules/tenant-staff/tenant-staff.service';
import { AuditService } from '../src/core/audit/audit.service';
import { SubjectsService } from '../src/modules/subjects/subjects.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

function fakeContext(headers: Record<string, string>): { context: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describeIfDb('tenant staff auth (live Postgres)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let accounts: AccountsService;
  let guard: TenantActorGuard;
  let staffService: TenantStaffService;
  let tenantId: string;
  let apiKeyPlaintext: string;
  const testTenantIds: string[] = [];
  const testPhones: string[] = [];

  beforeAll(async () => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    accounts = new AccountsService(prismaService);
    guard = new TenantActorGuard(prismaService, accounts);
    staffService = new TenantStaffService(prismaService, new AuditService());

    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug: 'tenant-staff-spec-tenant' },
      update: {},
      create: { name: 'Tenant Staff Spec Tenant', slug: 'tenant-staff-spec-tenant' },
    });
    tenantId = tenant.id;
    testTenantIds.push(tenantId);

    const key = generateApiKey('test');
    apiKeyPlaintext = key.plaintext;
    await migratorPrisma.tenantApiKey.create({
      data: { tenantId, keyPrefix: key.prefix, keyHash: key.hash, scopes: [] },
    });
  });

  afterAll(async () => {
    await migratorPrisma.tenantStaffMembership.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.tenantApiKey.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.tenant.deleteMany({ where: { id: { in: testTenantIds } } });
    await migratorPrisma.accountSession.deleteMany({ where: { account: { phone: { in: testPhones } } } });
    await migratorPrisma.account.deleteMany({ where: { phone: { in: testPhones } } });
    await migratorPrisma.$disconnect();
    await prismaService.onModuleDestroy();
  });

  function uniquePhone(label: string): string {
    const phone = `+1555${label}${Date.now().toString().slice(-4)}`;
    testPhones.push(phone);
    return phone;
  }

  async function realAccountSession(phone: string): Promise<string> {
    const account = await migratorPrisma.account.upsert({
      where: { phone },
      update: {},
      create: { phone, phoneVerifiedAt: new Date() },
    });
    const session = generateSessionToken();
    await migratorPrisma.accountSession.create({
      data: { accountId: account.id, tokenHash: session.hash, expiresAt: new Date(Date.now() + 3_600_000) },
    });
    return session.plaintext;
  }

  describe('TenantStaffService', () => {
    it('rejects inviting a phone with no existing nID account', async () => {
      await expect(
        staffService.invite(tenantId, 'key_1', { phone: '+19999999999999' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('invites an existing account and the membership is real in Postgres', async () => {
      const phone = uniquePhone('s1');
      await migratorPrisma.account.create({ data: { phone, phoneVerifiedAt: new Date() } });

      const result = await staffService.invite(tenantId, 'key_1', { phone });
      expect(result.tenantId).toBe(tenantId);
      expect(result.phone).toBe(phone);
      expect(result.role).toBe('STAFF');

      const stored = await migratorPrisma.tenantStaffMembership.findFirst({ where: { tenantId, accountId: result.accountId } });
      expect(stored).not.toBeNull();
    });

    it('inviting the same phone twice updates the role instead of duplicating', async () => {
      const phone = uniquePhone('s2');
      await migratorPrisma.account.create({ data: { phone, phoneVerifiedAt: new Date() } });

      await staffService.invite(tenantId, 'key_1', { phone, role: 'STAFF' });
      const second = await staffService.invite(tenantId, 'key_1', { phone, role: 'ADMIN' });
      expect(second.role).toBe('ADMIN');

      const rows = await migratorPrisma.tenantStaffMembership.findMany({ where: { tenantId, accountId: second.accountId } });
      expect(rows).toHaveLength(1);
    });

    it('list() returns real membership rows with phone attached', async () => {
      const phone = uniquePhone('s3');
      await migratorPrisma.account.create({ data: { phone, phoneVerifiedAt: new Date() } });
      await staffService.invite(tenantId, 'key_1', { phone });

      const list = await staffService.list(tenantId, 'key_1');
      expect(list.some((m) => m.phone === phone)).toBe(true);
    });
  });

  describe('TenantActorGuard', () => {
    it('rejects a request with no Authorization header', async () => {
      const { context } = fakeContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('accepts a real tenant API key, same as ApiKeyGuard', async () => {
      const { context, request } = fakeContext({ authorization: `Bearer ${apiKeyPlaintext}` });
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request['actor']).toMatchObject({ tenantId, actorType: 'API_KEY' });
    });

    it('rejects a revoked API key', async () => {
      const key = generateApiKey('test');
      await migratorPrisma.tenantApiKey.create({
        data: { tenantId, keyPrefix: key.prefix, keyHash: key.hash, scopes: [], revokedAt: new Date() },
      });
      const { context } = fakeContext({ authorization: `Bearer ${key.plaintext}` });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('accepts a real staff Account session with exactly one membership', async () => {
      const phone = uniquePhone('g1');
      await migratorPrisma.account.create({ data: { phone, phoneVerifiedAt: new Date() } });
      await staffService.invite(tenantId, 'key_1', { phone });
      const token = await realAccountSession(phone);

      const { context, request } = fakeContext({ authorization: `Bearer ${token}` });
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request['actor']).toMatchObject({ tenantId, actorType: 'TENANT_STAFF' });
    });

    it('rejects a valid session for an account that is staff nowhere', async () => {
      const phone = uniquePhone('g2');
      await migratorPrisma.account.create({ data: { phone, phoneVerifiedAt: new Date() } });
      const token = await realAccountSession(phone);

      const { context } = fakeContext({ authorization: `Bearer ${token}` });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('requires X-Tenant-Id when an account is staff on more than one tenant, and honors it', async () => {
      const otherTenant = await migratorPrisma.tenant.upsert({
        where: { slug: 'tenant-staff-spec-tenant-2' },
        update: {},
        create: { name: 'Tenant Staff Spec Tenant 2', slug: 'tenant-staff-spec-tenant-2' },
      });
      testTenantIds.push(otherTenant.id);

      const phone = uniquePhone('g3');
      await migratorPrisma.account.create({ data: { phone, phoneVerifiedAt: new Date() } });
      await staffService.invite(tenantId, 'key_1', { phone });
      await staffService.invite(otherTenant.id, 'key_1', { phone });
      const token = await realAccountSession(phone);

      const withoutHeader = fakeContext({ authorization: `Bearer ${token}` });
      await expect(guard.canActivate(withoutHeader.context)).rejects.toThrow(BadRequestException);

      const withHeader = fakeContext({ authorization: `Bearer ${token}`, 'x-tenant-id': otherTenant.id });
      await expect(guard.canActivate(withHeader.context)).resolves.toBe(true);
      expect(withHeader.request['actor']).toMatchObject({ tenantId: otherTenant.id, actorType: 'TENANT_STAFF' });
    });

    it('rejects X-Tenant-Id naming a tenant this account is not staff on', async () => {
      const phone = uniquePhone('g4');
      await migratorPrisma.account.create({ data: { phone, phoneVerifiedAt: new Date() } });
      await staffService.invite(tenantId, 'key_1', { phone });
      const token = await realAccountSession(phone);

      const { context } = fakeContext({ authorization: `Bearer ${token}`, 'x-tenant-id': 'not-a-real-tenant-id' });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('rejects a token that is neither a real API key nor a real session', async () => {
      const { context } = fakeContext({ authorization: 'Bearer complete-nonsense' });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('SubjectsService.getBadges — actor-aware audit trail', () => {
    // subjects.controller.ts's :id/badges route (what apps/dashboard's
    // case-detail view reads) moved from ApiKeyGuard-only to
    // TenantActorGuard alongside verification-cases.controller.ts's own
    // routes — this is the regression that a live browser pass through
    // the dashboard actually caught (a staff session got "Invalid or
    // revoked API key" on this exact route before the fix).
    let subjects: SubjectsService;
    let subjectId: string;

    beforeAll(async () => {
      subjects = new SubjectsService(prismaService, new AuditService());
      const subject = await migratorPrisma.subject.create({ data: { tenantId, type: 'PERSON' } });
      subjectId = subject.id;
    });

    it('records a real TENANT_STAFF actor in the audit log, not a hardcoded API_KEY', async () => {
      const phone = uniquePhone('b1');
      await migratorPrisma.account.create({ data: { phone, phoneVerifiedAt: new Date() } });
      await staffService.invite(tenantId, 'key_1', { phone });
      const account = await migratorPrisma.account.findUniqueOrThrow({ where: { phone } });

      await subjects.getBadges(tenantId, 'TENANT_STAFF', account.id, subjectId);

      const entry = await migratorPrisma.auditLogEntry.findFirst({
        where: { tenantId, subjectId, action: 'subject.badges_read', actorType: 'TENANT_STAFF' },
        orderBy: { createdAt: 'desc' },
      });
      expect(entry?.actorId).toBe(account.id);
    });

    it('still records a real API_KEY actor when called with one', async () => {
      await subjects.getBadges(tenantId, 'API_KEY', 'key_1', subjectId);

      const entry = await migratorPrisma.auditLogEntry.findFirst({
        where: { tenantId, subjectId, action: 'subject.badges_read', actorType: 'API_KEY' },
        orderBy: { createdAt: 'desc' },
      });
      expect(entry?.actorId).toBe('key_1');
    });
  });

  it('sanity: hashApiKey/sha256Hex agree with what the guard actually looks up by', async () => {
    // Not a guard test — just proving the two crypto helpers this suite
    // relies on for direct-DB setup are the exact ones production code
    // uses, so a hand-rolled hash mismatch here can't hide a real bug.
    const key = generateApiKey('test');
    expect(hashApiKey(key.plaintext)).toBe(key.hash);
    const session = generateSessionToken();
    expect(sha256Hex(session.plaintext)).toBe(session.hash);
  });
});
