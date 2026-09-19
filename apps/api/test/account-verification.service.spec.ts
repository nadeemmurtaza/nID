/**
 * Live-Postgres coverage for AccountVerificationService — the Verification
 * Center's backend: read-only status (getStatus) and self-service case
 * creation against the platform tenant (createCase/listCases/getCase).
 *
 * A real TemporalClientService is never reachable in this sandbox (same
 * limitation every other test file in this repo works around — see
 * organization-verification.spec.ts's own header comment). createCase()'s
 * happy path uses a FAKE TemporalClientService whose startVerification()
 * just resolves immediately, so the real DB writes (Subject, Case,
 * VerificationMethodAttempt, VerificationSession) are genuinely proven
 * without a ~10s real connection-timeout per test; validation-rejection
 * tests use the bare `{} as TemporalClientService` stub already
 * established elsewhere, since they reject before that call is ever made.
 *
 *   RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@nid/db';
import { sha256Hex } from '@nid/shared-types';
import { PrismaService } from '../src/core/db/prisma.service';
import { AuditService } from '../src/core/audit/audit.service';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { CrossTenantBadgesService } from '../src/modules/badges/cross-tenant-badges.service';
import { VerificationCasesService } from '../src/modules/verification-cases/verification-cases.service';
import { AccountVerificationService, PLATFORM_TENANT_ID } from '../src/modules/account-verification/account-verification.service';
import type { TemporalClientService } from '../src/core/temporal/temporal-client.service';
import type { StorageService } from '../src/core/storage/storage.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('AccountVerificationService (live Postgres)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let accounts: AccountsService;
  let verification: AccountVerificationService;
  let verificationNoTemporal: AccountVerificationService;
  const testPhones: string[] = [];

  beforeAll(() => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    accounts = new AccountsService(prismaService);
    const audit = new AuditService();
    const badges = new CrossTenantBadgesService(prismaService);

    const workingTemporal = { startVerification: async () => undefined } as unknown as TemporalClientService;
    const cases = new VerificationCasesService(prismaService, audit, workingTemporal, {} as StorageService);
    verification = new AccountVerificationService(prismaService, badges, cases);

    // For the guard tests, which must reject before ever reaching the
    // Temporal call — same `{} as TemporalClientService` precedent
    // organization-verification.spec.ts already established.
    const casesNoTemporal = new VerificationCasesService(prismaService, audit, {} as TemporalClientService, {} as StorageService);
    verificationNoTemporal = new AccountVerificationService(prismaService, badges, casesNoTemporal);
  });

  afterAll(async () => {
    const accountIds = await migratorPrisma.account.findMany({ where: { phone: { in: testPhones } }, select: { id: true } });
    const ids = accountIds.map((a) => a.id);
    await migratorPrisma.verificationMethodAttempt.deleteMany({
      where: { case: { subject: { accountId: { in: ids } } } },
    });
    await migratorPrisma.verificationSession.deleteMany({ where: { case: { subject: { accountId: { in: ids } } } } });
    await migratorPrisma.verificationCase.deleteMany({ where: { subject: { accountId: { in: ids } } } });
    await migratorPrisma.subject.deleteMany({ where: { accountId: { in: ids } } });
    await migratorPrisma.phoneBadgeEvidence.deleteMany({ where: { phone: { in: testPhones } } });
    await migratorPrisma.phoneNameEvidence.deleteMany({ where: { phone: { in: testPhones } } });
    await migratorPrisma.accountSession.deleteMany({ where: { account: { phone: { in: testPhones } } } });
    await migratorPrisma.accountOtpCode.deleteMany({ where: { phone: { in: testPhones } } });
    await migratorPrisma.account.deleteMany({ where: { phone: { in: testPhones } } });
    await migratorPrisma.$disconnect();
    await prismaService.onModuleDestroy();
  });

  function uniquePhone(label: string): string {
    const phone = `+1555${label}${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}`;
    testPhones.push(phone);
    return phone;
  }

  async function makeAccount(label: string) {
    const phone = uniquePhone(label);
    return migratorPrisma.account.create({ data: { phone, phoneVerifiedAt: new Date() } });
  }

  describe('getStatus()', () => {
    it('returns empty/false status for a brand-new account with no evidence at all', async () => {
      const account = await makeAccount('status-empty');
      const status = await verification.getStatus(account);
      expect(status.badges).toEqual([]);
      expect(status.realName).toBeNull();
      expect(status.cnicPhoneLinked).toBe(false);
      expect(status.usernameEligible).toBe(false);
      expect(status.email).toEqual({ address: null, verifiedAt: null });
    });

    it('usernameEligible is true only with BOTH an IDENTITY badge AND CNIC+phone-linked evidence — matches requireVerifiedRealName() exactly', async () => {
      const account = await makeAccount('status-partial');
      const { tenantId } = await makeTestTenant('status-partial-tenant');
      const subject = await migratorPrisma.subject.create({
        data: { tenantId, type: 'PERSON', phone: account.phone, accountId: account.id, givenName: 'Zara', familyName: 'Iqbal' },
      });
      await migratorPrisma.phoneBadgeEvidence.create({
        data: { phone: account.phone, tenantId, subjectId: subject.id, claimType: 'IDENTITY', level: 'DOCUMENT_VERIFIED', verifiedAt: new Date() },
      });
      // document_ocr-sourced name evidence — a real IDENTITY badge AND a
      // real name exist, but NOT the CNIC+phone link. Deliberately proves
      // the same distinction profiles.service.spec.ts's own
      // "rejects a name verified only via document_ocr" test makes, from
      // the read side instead of the write-gate side.
      await migratorPrisma.phoneNameEvidence.create({
        data: { phone: account.phone, tenantId, subjectId: subject.id, caseId: 'test-case', method: 'document_ocr', givenName: 'Zara', familyName: 'Iqbal', verifiedAt: new Date() },
      });

      const status = await verification.getStatus(account);
      expect(status.badges.some((b) => b.claimType === 'IDENTITY')).toBe(true);
      expect(status.realName).toMatchObject({ value: 'Zara Iqbal', cnicPhoneLinked: false });
      expect(status.cnicPhoneLinked).toBe(false);
      expect(status.usernameEligible).toBe(false);

      // Now add the qualifying estamp_registry evidence — eligibility flips true.
      await migratorPrisma.phoneNameEvidence.create({
        data: { phone: account.phone, tenantId, subjectId: subject.id, caseId: 'test-case-2', method: 'estamp_registry', givenName: 'Zara', familyName: 'Iqbal', verifiedAt: new Date() },
      });
      const updated = await verification.getStatus(account);
      expect(updated.cnicPhoneLinked).toBe(true);
      expect(updated.usernameEligible).toBe(true);
    });

    it('reflects real emailVerifiedAt state from AccountsService.verifyEmail()', async () => {
      const account = await makeAccount('status-email');
      await accounts.startEmailVerification(account.id, `status-email-${Date.now()}@example.com`);
      const challenge = await migratorPrisma.accountEmailOtpCode.findFirstOrThrow({ where: { accountId: account.id } });
      await migratorPrisma.accountEmailOtpCode.update({ where: { id: challenge.id }, data: { codeHash: sha256Hex('222333') } });
      const updated = await accounts.verifyEmail(account.id, '222333');

      const status = await verification.getStatus(updated);
      expect(status.email.address).toBe(updated.email);
      expect(status.email.verifiedAt).not.toBeNull();
    });
  });

  describe('createCase() — validation guards (reject before reaching Temporal)', () => {
    it('rejects cnic-phone-link with no referenceId — the CNIC is required, not optional', async () => {
      const account = await makeAccount('guard-noref');
      await expect(
        verificationNoTemporal.createCase(account, { policyName: 'cnic-phone-link' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createCase() / listCases() / getCase() — real writes against the platform tenant', () => {
    it('creates a real Subject in the platform tenant and a real PENDING case with the ACCOUNT actor recorded', async () => {
      const account = await makeAccount('case-identity');
      const result = await verification.createCase(account, { policyName: 'identity' });

      expect(result.tenantId).toBe(PLATFORM_TENANT_ID);
      expect(result.status).toBe('PENDING');
      expect(typeof result.hostedUrl).toBe('string');

      const subject = await migratorPrisma.subject.findFirstOrThrow({ where: { accountId: account.id } });
      expect(subject.tenantId).toBe(PLATFORM_TENANT_ID);
      expect(subject.phone).toBe(account.phone);

      const auditRow = await migratorPrisma.auditLogEntry.findFirstOrThrow({
        where: { tenantId: PLATFORM_TENANT_ID, caseId: result.id },
      });
      expect(auditRow.actorType).toBe('ACCOUNT');
      expect(auditRow.actorId).toBe(account.id);
    });

    it('reuses the same Subject across multiple self-service cases for one Account, never creating a second one', async () => {
      const account = await makeAccount('case-reuse');
      await verification.createCase(account, { policyName: 'identity' });
      await verification.createCase(account, { policyName: 'cnic-phone-link', referenceId: '35202-1234567-8' });

      const subjects = await migratorPrisma.subject.findMany({ where: { accountId: account.id, tenantId: PLATFORM_TENANT_ID } });
      expect(subjects).toHaveLength(1);
    });

    it('listCases() returns only this Account\'s own cases, and getCase() refuses a case belonging to a different Account', async () => {
      const accountA = await makeAccount('case-owner-a');
      const accountB = await makeAccount('case-owner-b');
      const createdA = await verification.createCase(accountA, { policyName: 'identity' });
      await verification.createCase(accountB, { policyName: 'identity' });

      const listA = await verification.listCases(accountA);
      expect(listA).toHaveLength(1);
      expect(listA[0]!.id).toBe(createdA.id);

      await expect(verification.getCase(accountA, createdA.id)).resolves.toMatchObject({ id: createdA.id });
      await expect(verification.getCase(accountB, createdA.id)).rejects.toThrow(NotFoundException);
    });
  });

  async function makeTestTenant(slug: string): Promise<{ tenantId: string }> {
    const tenant = await migratorPrisma.tenant.upsert({ where: { slug }, update: {}, create: { name: slug, slug } });
    return { tenantId: tenant.id };
  }
});
