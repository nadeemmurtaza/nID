/**
 * Live-Postgres coverage for "an organization can invite employees who
 * don't have an nID account yet, without ever taking control of that
 * account" and "an organization can create and manage only its own
 * verified brand profile" — the two capabilities added on top of the
 * existing KYB/membership machinery (organization-verification.spec.ts).
 *
 * Same live-Postgres, RUN_DB_TESTS-gated, direct-instantiation approach as
 * every other spec in this file — see tenant-staff.spec.ts's own header.
 * A real bug was caught writing this feature's own live-curl validation
 * pass (not by this file): Subject.accountId was wrongly @unique,
 * which broke inviting the same phone into a second Organization under a
 * different tenant. Fixed in schema.prisma/the migration before this file
 * was written — the cross-org tests below exist specifically to keep that
 * fixed.
 *
 *   RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@nid/db';
import { generateApiKey, sha256Hex } from '@nid/shared-types';
import { PrismaService } from '../src/core/db/prisma.service';
import { AuditService } from '../src/core/audit/audit.service';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { CrossTenantBadgesService } from '../src/modules/badges/cross-tenant-badges.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('organization employee invites + brand profiles (live Postgres, no Temporal)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let accounts: AccountsService;
  let organizations: OrganizationsService;
  let profiles: ProfilesService;
  const testTenantIds: string[] = [];
  const testPhones: string[] = [];

  beforeAll(() => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    accounts = new AccountsService(prismaService);
    organizations = new OrganizationsService(prismaService, new AuditService());
    profiles = new ProfilesService(prismaService, new CrossTenantBadgesService(prismaService), organizations);
  });

  afterAll(async () => {
    await migratorPrisma.profile.deleteMany({ where: { organization: { tenantId: { in: testTenantIds } } } });
    await migratorPrisma.organizationMembership.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.verificationCase.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.organization.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.subject.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.verificationPolicy.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.tenantApiKey.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.tenant.deleteMany({ where: { id: { in: testTenantIds } } });
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

  async function makeTenant(slug: string): Promise<{ tenantId: string; apiKeyId: string }> {
    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug },
      update: {},
      create: { name: slug, slug },
    });
    testTenantIds.push(tenant.id);
    const key = generateApiKey('test');
    const created = await migratorPrisma.tenantApiKey.create({
      data: { tenantId: tenant.id, keyPrefix: key.prefix, keyHash: key.hash, scopes: [] },
    });
    return { tenantId: tenant.id, apiKeyId: created.id };
  }

  async function makeKybPolicy(tenantId: string, name: string) {
    return migratorPrisma.verificationPolicy.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: { methods: ['business_registry'], claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED' },
      create: { tenantId, name, methods: ['business_registry'], claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED' },
    });
  }

  async function verifyOrg(tenantId: string, subjectId: string, policyId: string): Promise<void> {
    await migratorPrisma.verificationCase.create({
      data: {
        tenantId,
        subjectId,
        policyId,
        status: 'APPROVED',
        claimType: 'IDENTITY',
        level: 'REGISTRY_VERIFIED',
        resolvedAt: new Date(),
      },
    });
  }

  describe('OrganizationsService.invite()', () => {
    it('pre-provisions a shell Account (phoneVerifiedAt null) for a phone with no account yet', async () => {
      const { tenantId, apiKeyId } = await makeTenant('invite-spec-shell');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Shell Test Org' });
      const phone = uniquePhone('shell');

      const membership = await organizations.invite(tenantId, apiKeyId, org.id, { phone });
      expect(membership.status).toBe('PENDING');
      expect(membership.accountId).not.toBeNull();

      const account = await migratorPrisma.account.findUniqueOrThrow({ where: { phone } });
      expect(account.phoneVerifiedAt).toBeNull();
    });

    it("the invited phone's real OTP verification claims the shell — zero special-case code needed", async () => {
      const { tenantId, apiKeyId } = await makeTenant('invite-spec-claim');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Claim Test Org' });
      const phone = uniquePhone('claim');
      await organizations.invite(tenantId, apiKeyId, org.id, { phone });

      const before = await migratorPrisma.account.findUniqueOrThrow({ where: { phone } });
      expect(before.phoneVerifiedAt).toBeNull();

      await accounts.startOtp(phone);
      await overwriteOtpCode(phone, '424242');
      const { account } = await accounts.verifyOtp(phone, '424242');
      expect(account.id).toBe(before.id);
      expect(account.phoneVerifiedAt).not.toBeNull();
    });

    it('re-inviting an already-ACTIVE member updates role but never resets status back to PENDING', async () => {
      const { tenantId, apiKeyId } = await makeTenant('invite-spec-reinvite');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Reinvite Test Org' });
      const phone = uniquePhone('reinv');
      const first = await organizations.invite(tenantId, apiKeyId, org.id, { phone, role: 'Employee' });
      await migratorPrisma.organizationMembership.update({
        where: { id: first.id },
        data: { status: 'ACTIVE', respondedAt: new Date() },
      });

      const second = await organizations.invite(tenantId, apiKeyId, org.id, { phone, role: 'Manager' });
      expect(second.id).toBe(first.id);
      expect(second.status).toBe('ACTIVE');
      expect(second.role).toBe('Manager');
    });

    it('inviting the SAME phone into a SECOND organization under a different tenant works (the cardinality bug this feature caught)', async () => {
      const tenantA = await makeTenant('invite-spec-cross-a');
      const tenantB = await makeTenant('invite-spec-cross-b');
      const orgA = await organizations.create(tenantA.tenantId, tenantA.apiKeyId, { legalName: 'Cross Org A' });
      const orgB = await organizations.create(tenantB.tenantId, tenantB.apiKeyId, { legalName: 'Cross Org B' });
      const phone = uniquePhone('cross');

      const membershipA = await organizations.invite(tenantA.tenantId, tenantA.apiKeyId, orgA.id, { phone });
      const membershipB = await organizations.invite(tenantB.tenantId, tenantB.apiKeyId, orgB.id, { phone });

      expect(membershipA.accountId).toBe(membershipB.accountId);
      expect(membershipA.tenantId).not.toBe(membershipB.tenantId);

      const subjects = await migratorPrisma.subject.findMany({ where: { accountId: membershipA.accountId } });
      expect(subjects).toHaveLength(2);
      expect(new Set(subjects.map((s) => s.tenantId))).toEqual(new Set([tenantA.tenantId, tenantB.tenantId]));
    });
  });

  describe('OrganizationsService.listMyInvites() / respondToInvite()', () => {
    it('lists only PENDING invites for this account, with the inviting org\'s legal name', async () => {
      const { tenantId, apiKeyId } = await makeTenant('invite-spec-list');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'List Test Org' });
      const phone = uniquePhone('list');
      const membership = await organizations.invite(tenantId, apiKeyId, org.id, { phone });

      const invites = await organizations.listMyInvites(membership.accountId!);
      expect(invites).toHaveLength(1);
      expect(invites[0]?.organization.legalName).toBe('List Test Org');
    });

    it('never lists another account\'s invites', async () => {
      const { tenantId, apiKeyId } = await makeTenant('invite-spec-list-other');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Other Account Org' });
      await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('otheracct') });

      const unrelatedAccount = await migratorPrisma.account.create({ data: { phone: uniquePhone('unrel') } });
      const invites = await organizations.listMyInvites(unrelatedAccount.id);
      expect(invites).toHaveLength(0);
    });

    it('accept flips PENDING to ACTIVE and sets respondedAt', async () => {
      const { tenantId, apiKeyId } = await makeTenant('invite-spec-accept');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Accept Test Org' });
      const phone = uniquePhone('accept');
      const membership = await organizations.invite(tenantId, apiKeyId, org.id, { phone });

      const accepted = await organizations.respondToInvite(membership.accountId!, membership.id, 'ACCEPTED');
      expect(accepted.status).toBe('ACTIVE');
      expect(accepted.respondedAt).not.toBeNull();
    });

    it('decline flips PENDING to DECLINED and removes it from the pending list', async () => {
      const { tenantId, apiKeyId } = await makeTenant('invite-spec-decline');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Decline Test Org' });
      const phone = uniquePhone('decline');
      const membership = await organizations.invite(tenantId, apiKeyId, org.id, { phone });

      const declined = await organizations.respondToInvite(membership.accountId!, membership.id, 'DECLINED');
      expect(declined.status).toBe('DECLINED');
      const invites = await organizations.listMyInvites(membership.accountId!);
      expect(invites).toHaveLength(0);
    });

    it('rejects a different account responding to someone else\'s invite — 404, not 403, so it can\'t be used to probe existence', async () => {
      const { tenantId, apiKeyId } = await makeTenant('invite-spec-wrong-acct');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Wrong Account Org' });
      const membership = await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('wrongacct') });
      const someoneElse = await migratorPrisma.account.create({ data: { phone: uniquePhone('someoneelse') } });

      await expect(organizations.respondToInvite(someoneElse.id, membership.id, 'ACCEPTED')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects responding to an invite that already got a response', async () => {
      const { tenantId, apiKeyId } = await makeTenant('invite-spec-already');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Already Responded Org' });
      const membership = await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('already') });
      await organizations.respondToInvite(membership.accountId!, membership.id, 'ACCEPTED');

      await expect(organizations.respondToInvite(membership.accountId!, membership.id, 'DECLINED')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cross-organization isolation', () => {
    it("org A's member list never reveals anything about org B, even for the same person", async () => {
      const tenantA = await makeTenant('invite-spec-iso-a');
      const tenantB = await makeTenant('invite-spec-iso-b');
      const orgA = await organizations.create(tenantA.tenantId, tenantA.apiKeyId, { legalName: 'Isolation Org A' });
      const orgB = await organizations.create(tenantB.tenantId, tenantB.apiKeyId, { legalName: 'Isolation Org B' });
      const phone = uniquePhone('iso');

      const membershipA = await organizations.invite(tenantA.tenantId, tenantA.apiKeyId, orgA.id, { phone });
      await organizations.invite(tenantB.tenantId, tenantB.apiKeyId, orgB.id, { phone });
      await organizations.respondToInvite(membershipA.accountId!, membershipA.id, 'ACCEPTED');

      const membersOfA = await organizations.listMembers(tenantA.tenantId, tenantA.apiKeyId, orgA.id);
      expect(membersOfA).toHaveLength(1);
      expect(membersOfA[0]?.organizationId).toBe(orgA.id);
    });
  });

  describe('OrganizationsService.requireActiveAdmin()', () => {
    it('rejects a non-member, a PENDING member, and an ACTIVE non-admin member — accepts only ACTIVE + isAdmin', async () => {
      const { tenantId, apiKeyId } = await makeTenant('admin-spec');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Admin Gate Org' });

      const stranger = await migratorPrisma.account.create({ data: { phone: uniquePhone('stranger') } });
      await expect(organizations.requireActiveAdmin(org.id, stranger.id)).rejects.toThrow(ForbiddenException);

      const pending = await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('pendingadmin'), isAdmin: true });
      await expect(organizations.requireActiveAdmin(org.id, pending.accountId!)).rejects.toThrow(ForbiddenException);

      const nonAdmin = await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('nonadmin'), isAdmin: false });
      await organizations.respondToInvite(nonAdmin.accountId!, nonAdmin.id, 'ACCEPTED');
      await expect(organizations.requireActiveAdmin(org.id, nonAdmin.accountId!)).rejects.toThrow(ForbiddenException);

      const admin = await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('realadmin'), isAdmin: true });
      await organizations.respondToInvite(admin.accountId!, admin.id, 'ACCEPTED');
      const result = await organizations.requireActiveAdmin(org.id, admin.accountId!);
      expect(result.id).toBe(admin.id);
    });
  });

  describe('ProfilesService org-owned profile methods', () => {
    it('rejects creating a brand profile for an unverified organization', async () => {
      const { tenantId, apiKeyId } = await makeTenant('profile-spec-unverified');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Unverified Brand Org' });
      const admin = await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('unverifiedadmin'), isAdmin: true });
      await organizations.respondToInvite(admin.accountId!, admin.id, 'ACCEPTED');

      await expect(
        profiles.createForOrganization(admin.accountId!, org.id, { slug: `unverified-${Date.now()}`, displayName: 'Unverified Brand Org' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-admin member creating a brand profile even for a verified organization', async () => {
      const { tenantId, apiKeyId } = await makeTenant('profile-spec-nonadmin');
      const policy = await makeKybPolicy(tenantId, 'org-kyb-registry-profile-spec-nonadmin');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Verified But Non-Admin Org' });
      await verifyOrg(tenantId, org.subjectId, policy.id);
      const nonAdmin = await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('profilenonadmin'), isAdmin: false });
      await organizations.respondToInvite(nonAdmin.accountId!, nonAdmin.id, 'ACCEPTED');

      await expect(
        profiles.createForOrganization(nonAdmin.accountId!, org.id, { slug: `nonadmin-${Date.now()}`, displayName: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates a brand profile once verified + admin, rejects a second one, and the public projection sources badges from the org\'s own KYB', async () => {
      const { tenantId, apiKeyId } = await makeTenant('profile-spec-success');
      const policy = await makeKybPolicy(tenantId, 'org-kyb-registry-profile-spec-success');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Fully Verified Brand Org' });
      await verifyOrg(tenantId, org.subjectId, policy.id);
      const admin = await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('profileadmin'), isAdmin: true });
      await organizations.respondToInvite(admin.accountId!, admin.id, 'ACCEPTED');

      const slug = 'fully-verified-brand-org';
      const created = await profiles.createForOrganization(admin.accountId!, org.id, {
        slug,
        displayName: 'Fully Verified Brand Org',
        isPublished: true,
      });
      expect(created.organizationId).toBe(org.id);
      expect(created.accountId).toBeNull();

      await expect(
        profiles.createForOrganization(admin.accountId!, org.id, { slug: `${slug}-again`, displayName: 'x' }),
      ).rejects.toThrow(ConflictException);

      const publicView = await profiles.getPublicBySlug(slug);
      expect(publicView.badges).toEqual([
        expect.objectContaining({ claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED' }),
      ]);
    });

    it('getForOrganization/updateForOrganization also require ACTIVE + isAdmin', async () => {
      const { tenantId, apiKeyId } = await makeTenant('profile-spec-update');
      const policy = await makeKybPolicy(tenantId, 'org-kyb-registry-profile-spec-update');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Update Gate Org' });
      await verifyOrg(tenantId, org.subjectId, policy.id);
      const admin = await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('updateadmin'), isAdmin: true });
      await organizations.respondToInvite(admin.accountId!, admin.id, 'ACCEPTED');
      const slug = 'update-gate-org';
      await profiles.createForOrganization(admin.accountId!, org.id, { slug, displayName: 'Update Gate Org' });

      const stranger = await migratorPrisma.account.create({ data: { phone: uniquePhone('updatestranger') } });
      await expect(profiles.getForOrganization(stranger.id, org.id)).rejects.toThrow(ForbiddenException);
      await expect(
        profiles.updateForOrganization(stranger.id, org.id, { headline: 'hijacked' }),
      ).rejects.toThrow(ForbiddenException);

      const updated = await profiles.updateForOrganization(admin.accountId!, org.id, { headline: 'Real update' });
      expect(updated.headline).toBe('Real update');
    });
  });

  /** Mirrors accounts.service.spec.ts's own helper: overwrite the persisted hash to one whose plaintext this test knows, rather than scraping the dev-mode log line. */
  async function overwriteOtpCode(phone: string, knownCode: string): Promise<void> {
    await migratorPrisma.accountOtpCode.updateMany({
      where: { phone },
      data: { codeHash: sha256Hex(knownCode) },
    });
  }
});
