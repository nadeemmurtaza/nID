/**
 * Live-Postgres coverage for the username system's creation/rename gates:
 * "available for verified account only" and "will for sure contain the
 * realname in priority" (personal profiles) or the organization's verified
 * legalName (brand profiles). PhoneBadgeEvidence/PhoneNameEvidence rows are
 * seeded directly rather than run through a real VerificationCase — this
 * file tests ProfilesService's own gating logic in isolation, the same
 * split organization-employee-invites.spec.ts and
 * verification-method.activity.spec.ts already establish between "does the
 * evidence get produced correctly" (proven elsewhere) and "does the
 * consumer of that evidence enforce the right rule".
 *
 *   RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@nid/db';
import { generateApiKey } from '@nid/shared-types';
import { PrismaService } from '../src/core/db/prisma.service';
import { AuditService } from '../src/core/audit/audit.service';
import { CrossTenantBadgesService } from '../src/modules/badges/cross-tenant-badges.service';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('ProfilesService — username creation/rename gates (live Postgres, no Temporal)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let organizations: OrganizationsService;
  let profiles: ProfilesService;
  const testTenantIds: string[] = [];
  const testPhones: string[] = [];
  const testProfileIds: string[] = [];

  beforeAll(() => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    organizations = new OrganizationsService(prismaService, new AuditService());
    profiles = new ProfilesService(prismaService, new CrossTenantBadgesService(prismaService), organizations);
  });

  afterAll(async () => {
    await migratorPrisma.profile.deleteMany({ where: { id: { in: testProfileIds } } });
    await migratorPrisma.organizationMembership.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.verificationCase.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.organization.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.subject.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.verificationPolicy.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.tenantApiKey.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.tenant.deleteMany({ where: { id: { in: testTenantIds } } });
    await migratorPrisma.phoneNameEvidence.deleteMany({ where: { phone: { in: testPhones } } });
    await migratorPrisma.phoneBadgeEvidence.deleteMany({ where: { phone: { in: testPhones } } });
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
    const tenant = await migratorPrisma.tenant.upsert({ where: { slug }, update: {}, create: { name: slug, slug } });
    testTenantIds.push(tenant.id);
    const key = generateApiKey('test');
    const created = await migratorPrisma.tenantApiKey.create({
      data: { tenantId: tenant.id, keyPrefix: key.prefix, keyHash: key.hash, scopes: [] },
    });
    return { tenantId: tenant.id, apiKeyId: created.id };
  }

  /** An Account whose identity is fully verified with a known real name — the happy-path fixture every "verified" test builds on. */
  async function makeVerifiedAccount(phoneLabel: string, name: { givenName: string; familyName: string }) {
    const phone = uniquePhone(phoneLabel);
    const account = await migratorPrisma.account.create({ data: { phone, phoneVerifiedAt: new Date() } });
    const { tenantId } = await makeTenant(`profiles-spec-${phoneLabel}`);
    const subject = await migratorPrisma.subject.create({
      data: { tenantId, type: 'PERSON', phone, accountId: account.id, ...name },
    });
    await migratorPrisma.phoneBadgeEvidence.create({
      data: { phone, tenantId, subjectId: subject.id, claimType: 'IDENTITY', level: 'DOCUMENT_VERIFIED', verifiedAt: new Date() },
    });
    await migratorPrisma.phoneNameEvidence.create({
      data: { phone, tenantId, subjectId: subject.id, caseId: 'test-case', ...name, verifiedAt: new Date() },
    });
    return { account };
  }

  describe('create() — verified-account gate', () => {
    it('rejects an account with no IDENTITY badge at all', async () => {
      const phone = uniquePhone('unverified');
      const account = await migratorPrisma.account.create({ data: { phone, phoneVerifiedAt: new Date() } });

      await expect(profiles.create(account, { slug: 'whatever', displayName: 'Whatever' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects an account with an IDENTITY badge but no PhoneNameEvidence (verified some other way, never with a document)', async () => {
      const phone = uniquePhone('badgeonly');
      const account = await migratorPrisma.account.create({ data: { phone, phoneVerifiedAt: new Date() } });
      const { tenantId } = await makeTenant('profiles-spec-badgeonly');
      const subject = await migratorPrisma.subject.create({ data: { tenantId, type: 'PERSON', phone, accountId: account.id } });
      await migratorPrisma.phoneBadgeEvidence.create({
        data: { phone, tenantId, subjectId: subject.id, claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED', verifiedAt: new Date() },
      });

      await expect(profiles.create(account, { slug: 'whatever', displayName: 'Whatever' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create() — realname-priority validation', () => {
    it('rejects a slug unrelated to the verified name', async () => {
      const { account } = await makeVerifiedAccount('mismatch', { givenName: 'Anna Maria', familyName: 'Eriksson' });

      await expect(
        profiles.create(account, { slug: 'cool-username-123', displayName: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a slug that exactly matches the verified name', async () => {
      const { account } = await makeVerifiedAccount('exact', { givenName: 'Anna Maria', familyName: 'Eriksson' });

      const profile = await profiles.create(account, {
        slug: 'anna-maria-eriksson',
        displayName: 'Anna Eriksson',
      });
      testProfileIds.push(profile.id);
      expect(profile.slug).toBe('anna-maria-eriksson');
      expect(profile.usernameSetAt).not.toBeNull();
    });

    it('accepts a hyphen-qualified slug built on top of the verified name', async () => {
      const { account } = await makeVerifiedAccount('suffix', { givenName: 'Anna Maria', familyName: 'Eriksson' });

      const profile = await profiles.create(account, {
        slug: 'anna-maria-eriksson-nyc',
        displayName: 'Anna Eriksson (NYC)',
      });
      testProfileIds.push(profile.id);
      expect(profile.slug).toBe('anna-maria-eriksson-nyc');
    });

    it('rejects a second profile for an account that already has one — one username, forever, per person', async () => {
      const { account } = await makeVerifiedAccount('dup', { givenName: 'Dana', familyName: 'Lee' });
      const first = await profiles.create(account, { slug: 'dana-lee', displayName: 'Dana Lee' });
      testProfileIds.push(first.id);

      await expect(profiles.create(account, { slug: 'dana-lee-2', displayName: 'Dana Lee' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update() — re-validates only when the slug actually changes', () => {
    it('rejects changing to a slug unrelated to the verified name', async () => {
      const { account } = await makeVerifiedAccount('updatereject', { givenName: 'Bob', familyName: 'Smith' });
      const profile = await profiles.create(account, { slug: 'bob-smith', displayName: 'Bob Smith' });
      testProfileIds.push(profile.id);

      await expect(profiles.update(account, { slug: 'totally-different' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows a non-slug field update without re-checking the name rule', async () => {
      const { account } = await makeVerifiedAccount('updateother', { givenName: 'Carol', familyName: 'Jones' });
      const profile = await profiles.create(account, { slug: 'carol-jones', displayName: 'Carol Jones' });
      testProfileIds.push(profile.id);

      const updated = await profiles.update(account, { headline: 'A new headline' });
      expect(updated.headline).toBe('A new headline');
      expect(updated.slug).toBe('carol-jones');
    });
  });

  describe('update() — 7-day reconsideration window, permanent lock, govt-rename unlock', () => {
    it('allows a rename within the 7-day reconsideration window', async () => {
      const { account } = await makeVerifiedAccount('withinwindow', { givenName: 'Eve', familyName: 'Nguyen' });
      const profile = await profiles.create(account, { slug: 'eve-nguyen', displayName: 'Eve Nguyen' });
      testProfileIds.push(profile.id);

      const updated = await profiles.update(account, { slug: 'eve-nguyen-2' });
      expect(updated.slug).toBe('eve-nguyen-2');
      expect(updated.usernameSourceName).toBe('eve-nguyen');
    });

    it('rejects a rename once the 7-day window has elapsed and the verified name has not changed', async () => {
      const { account } = await makeVerifiedAccount('expiredwindow', { givenName: 'Frank', familyName: 'Ortiz' });
      const profile = await profiles.create(account, { slug: 'frank-ortiz', displayName: 'Frank Ortiz' });
      testProfileIds.push(profile.id);
      await migratorPrisma.profile.update({
        where: { id: profile.id },
        data: { usernameSetAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
      });

      await expect(profiles.update(account, { slug: 'frank-ortiz-nyc' })).rejects.toThrow(ForbiddenException);
    });

    it('allows a rename past the 7-day lock when the verified name has genuinely changed (govt-record rename)', async () => {
      const { account } = await makeVerifiedAccount('renameunlock', { givenName: 'Grace', familyName: 'Kim' });
      const profile = await profiles.create(account, { slug: 'grace-kim', displayName: 'Grace Kim' });
      testProfileIds.push(profile.id);
      await migratorPrisma.profile.update({
        where: { id: profile.id },
        data: { usernameSetAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
      });

      // The signal a real legal-name change produces: a second, later
      // PhoneNameEvidence row with a different name (matches the workflows
      // activity's own "appends, never overwrites" behavior).
      const account2 = await migratorPrisma.account.findUniqueOrThrow({ where: { id: account.id } });
      const subject = await migratorPrisma.subject.findFirstOrThrow({ where: { accountId: account2.id } });
      await migratorPrisma.phoneNameEvidence.create({
        data: {
          phone: account2.phone,
          tenantId: subject.tenantId,
          subjectId: subject.id,
          caseId: 'test-case-rename',
          givenName: 'Grace',
          familyName: 'Lindqvist',
          verifiedAt: new Date(),
        },
      });

      const updated = await profiles.update(account, { slug: 'grace-lindqvist' });
      expect(updated.slug).toBe('grace-lindqvist');
      expect(updated.usernameSourceName).toBe('grace-lindqvist');
      expect(updated.usernameSetAt.getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it('still rejects a post-lock rename to a slug that does not match the NEW verified name', async () => {
      const { account } = await makeVerifiedAccount('renamemismatch', { givenName: 'Hank', familyName: 'Osei' });
      const profile = await profiles.create(account, { slug: 'hank-osei', displayName: 'Hank Osei' });
      testProfileIds.push(profile.id);
      await migratorPrisma.profile.update({
        where: { id: profile.id },
        data: { usernameSetAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
      });
      const account2 = await migratorPrisma.account.findUniqueOrThrow({ where: { id: account.id } });
      const subject = await migratorPrisma.subject.findFirstOrThrow({ where: { accountId: account2.id } });
      await migratorPrisma.phoneNameEvidence.create({
        data: {
          phone: account2.phone,
          tenantId: subject.tenantId,
          subjectId: subject.id,
          caseId: 'test-case-rename-mismatch',
          givenName: 'Hank',
          familyName: 'Boateng',
          verifiedAt: new Date(),
        },
      });

      await expect(profiles.update(account, { slug: 'totally-unrelated' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('createForOrganization() — brand profile derives from the verified legal name', () => {
    it('rejects a slug unrelated to the organization\'s legalName', async () => {
      const { tenantId, apiKeyId } = await makeTenant('profiles-spec-org-mismatch');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Acme Manufacturing Ltd' });
      await migratorPrisma.verificationCase.create({
        data: { tenantId, subjectId: org.subjectId, policyId: (await ensureAnyPolicy(tenantId)).id, status: 'APPROVED', claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED', resolvedAt: new Date() },
      });
      const admin = await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('orgadmin1'), isAdmin: true });
      await organizations.respondToInvite(admin.accountId!, admin.id, 'ACCEPTED');

      await expect(
        profiles.createForOrganization(admin.accountId!, org.id, { slug: 'nothing-like-it', displayName: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a slug derived from the verified legalName', async () => {
      const { tenantId, apiKeyId } = await makeTenant('profiles-spec-org-match');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Acme Manufacturing Ltd' });
      await migratorPrisma.verificationCase.create({
        data: { tenantId, subjectId: org.subjectId, policyId: (await ensureAnyPolicy(tenantId)).id, status: 'APPROVED', claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED', resolvedAt: new Date() },
      });
      const admin = await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('orgadmin2'), isAdmin: true });
      await organizations.respondToInvite(admin.accountId!, admin.id, 'ACCEPTED');

      const profile = await profiles.createForOrganization(admin.accountId!, org.id, {
        slug: 'acme-manufacturing-ltd',
        displayName: 'Acme Manufacturing',
      });
      testProfileIds.push(profile.id);
      expect(profile.slug).toBe('acme-manufacturing-ltd');
      expect(profile.organizationId).toBe(org.id);
    });
  });

  describe('getPublicBySlug() — realName is private by default, opt-in only', () => {
    it('omits realName when showRealName is left at its default (false)', async () => {
      const { account } = await makeVerifiedAccount('privdefault', { givenName: 'Ivy', familyName: 'Chen' });
      const profile = await profiles.create(account, { slug: 'ivy-chen', displayName: 'Ivy the Designer', isPublished: true });
      testProfileIds.push(profile.id);

      const publicProfile = await profiles.getPublicBySlug('ivy-chen');
      expect(publicProfile.realName).toBeNull();
    });

    it('exposes the verified name once the owner opts in via showRealName', async () => {
      const { account } = await makeVerifiedAccount('privoptin', { givenName: 'Jae', familyName: 'Park' });
      const profile = await profiles.create(account, {
        slug: 'jae-park',
        displayName: 'Jae the Consultant',
        isPublished: true,
        showRealName: true,
      });
      testProfileIds.push(profile.id);

      const publicProfile = await profiles.getPublicBySlug('jae-park');
      expect(publicProfile.realName).toBe('Jae Park');
    });

    it('exposes the organization legalName for a brand profile that opts in', async () => {
      const { tenantId, apiKeyId } = await makeTenant('profiles-spec-org-realname');
      const org = await organizations.create(tenantId, apiKeyId, { legalName: 'Northwind Traders Co' });
      await migratorPrisma.verificationCase.create({
        data: { tenantId, subjectId: org.subjectId, policyId: (await ensureAnyPolicy(tenantId)).id, status: 'APPROVED', claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED', resolvedAt: new Date() },
      });
      const admin = await organizations.invite(tenantId, apiKeyId, org.id, { phone: uniquePhone('orgrealname'), isAdmin: true });
      await organizations.respondToInvite(admin.accountId!, admin.id, 'ACCEPTED');
      const profile = await profiles.createForOrganization(admin.accountId!, org.id, {
        slug: 'northwind-traders-co',
        displayName: 'Northwind',
        isPublished: true,
        showRealName: true,
      });
      testProfileIds.push(profile.id);

      const publicProfile = await profiles.getPublicBySlug('northwind-traders-co');
      expect(publicProfile.realName).toBe('Northwind Traders Co');
    });
  });

  async function ensureAnyPolicy(tenantId: string) {
    return migratorPrisma.verificationPolicy.upsert({
      where: { tenantId_name: { tenantId, name: 'any-policy' } },
      update: {},
      create: { tenantId, name: 'any-policy', methods: ['business_registry'] },
    });
  }
});
