/**
 * Live-Postgres coverage for real KYB verification of the Organization
 * entity itself — as opposed to org_membership/agent_in_person_document
 * (already covered elsewhere), which verify a PERSON's relationship to an
 * already-verified Organization, never the Organization's own identity.
 *
 * Two things proven here that nothing proved before this pass existed:
 * (1) VerificationCasesService.create() rejects a method run against the
 * wrong Subject.type (subjectTypesAllowedFor's enforcement point — see
 * @nid/verification-providers's method-subject-types.ts), and (2)
 * OrganizationsService.getById()'s isVerified derivation correctly reads
 * back a real APPROVED IDENTITY case. The provider/activity layer itself
 * (business_registry, business_registration_document actually resolving
 * to PASSED for an ORGANIZATION Subject) is proven end to end in
 * apps/workflows/test/verification-method.activity.spec.ts, bypassing the
 * same unreachable Temporal server this file also can't reach — which is
 * exactly why the guard tests below only exercise create()'s REJECTION
 * path: that throws before create() ever reaches the Temporal call.
 *
 *   RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { BadRequestException } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@nid/db';
import { generateApiKey } from '@nid/shared-types';
import { PrismaService } from '../src/core/db/prisma.service';
import { AuditService } from '../src/core/audit/audit.service';
import { VerificationCasesService } from '../src/modules/verification-cases/verification-cases.service';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import type { TemporalClientService } from '../src/core/temporal/temporal-client.service';
import type { StorageService } from '../src/core/storage/storage.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('organization (KYB) verification (live Postgres, no Temporal)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let casesService: VerificationCasesService;
  let organizationsService: OrganizationsService;
  let tenantId: string;
  let apiKeyId: string;
  const testTenantIds: string[] = [];

  beforeAll(async () => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    const audit = new AuditService();
    organizationsService = new OrganizationsService(prismaService, audit);
    // The guard tests below all reject before create() reaches its
    // post-transaction `this.temporal.startVerification(...)` call, so a
    // real TemporalClientService/StorageService is never needed — this
    // suite can't reach a real Temporal server any more than
    // apps/workflows' own activity spec can (see its header comment).
    casesService = new VerificationCasesService(
      prismaService,
      audit,
      {} as TemporalClientService,
      {} as StorageService,
    );

    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug: 'org-verification-spec-tenant' },
      update: {},
      create: { name: 'Org Verification Spec Tenant', slug: 'org-verification-spec-tenant' },
    });
    tenantId = tenant.id;
    testTenantIds.push(tenantId);

    const key = generateApiKey('test');
    const created = await migratorPrisma.tenantApiKey.create({
      data: { tenantId, keyPrefix: key.prefix, keyHash: key.hash, scopes: [] },
    });
    apiKeyId = created.id;

    await migratorPrisma.verificationPolicy.upsert({
      where: { tenantId_name: { tenantId, name: 'org-kyb-registry' } },
      update: { methods: ['business_registry'], claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED' },
      create: {
        tenantId,
        name: 'org-kyb-registry',
        methods: ['business_registry'],
        claimType: 'IDENTITY',
        level: 'REGISTRY_VERIFIED',
      },
    });
    await migratorPrisma.verificationPolicy.upsert({
      where: { tenantId_name: { tenantId, name: 'test-otp' } },
      update: { methods: ['otp_sms'] },
      create: { tenantId, name: 'test-otp', methods: ['otp_sms'] },
    });
    await migratorPrisma.verificationPolicy.upsert({
      where: { tenantId_name: { tenantId, name: 'test-org-membership' } },
      update: { methods: ['org_membership'] },
      create: { tenantId, name: 'test-org-membership', methods: ['org_membership'] },
    });
  });

  afterAll(async () => {
    await migratorPrisma.verificationMethodAttempt.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.verificationCase.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.organization.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.subject.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.verificationPolicy.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.tenantApiKey.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.tenant.deleteMany({ where: { id: { in: testTenantIds } } });
    await migratorPrisma.$disconnect();
    await prismaService.onModuleDestroy();
  });

  describe('VerificationCasesService.create() — Subject.type guard', () => {
    it('rejects business_registry (ORGANIZATION-only) run against a PERSON subject', async () => {
      const person = await prismaService.forTenant(tenantId, (tx) =>
        tx.subject.create({ data: { tenantId, type: 'PERSON', phone: '+15559990001' } }),
      );

      const attempt = casesService.create(tenantId, { type: 'API_KEY', id: apiKeyId }, {
        subjectId: person.id,
        policyName: 'org-kyb-registry',
        referenceId: 'REG-1',
      });
      await expect(attempt).rejects.toThrow(BadRequestException);
      await expect(attempt).rejects.toThrow(/business_registry.*ORGANIZATION subject, not PERSON/);
    });

    it('rejects otp_sms (PERSON-only by default) run against an ORGANIZATION subject', async () => {
      const org = await organizationsService.create(tenantId, apiKeyId, { legalName: 'Org Not A Person' });

      await expect(
        casesService.create(tenantId, { type: 'API_KEY', id: apiKeyId }, {
          subjectId: org.subjectId,
          policyName: 'test-otp',
          phone: '+15551230000',
        }),
      ).rejects.toThrow(/otp_sms.*PERSON subject, not ORGANIZATION/);
    });

    it('rejects org_membership run against an ORGANIZATION subject — it verifies a PERSON\'s membership, never the org itself', async () => {
      const org = await organizationsService.create(tenantId, apiKeyId, { legalName: 'Org Membership Misuse' });

      await expect(
        casesService.create(tenantId, { type: 'API_KEY', id: apiKeyId }, {
          subjectId: org.subjectId,
          policyName: 'test-org-membership',
          organizationId: org.id,
        }),
      ).rejects.toThrow(/org_membership.*PERSON subject, not ORGANIZATION/);
    });
  });

  describe('OrganizationsService.getById() — isVerified derivation', () => {
    it('is false with no APPROVED IDENTITY case', async () => {
      const org = await organizationsService.create(tenantId, apiKeyId, { legalName: 'Unverified Org' });
      const result = await organizationsService.getById(tenantId, apiKeyId, org.id);
      expect(result.isVerified).toBe(false);
      expect(result.verifiedLevel).toBeNull();
    });

    it('is true once a real business_registry case (proven end to end in apps/workflows) resolves APPROVED', async () => {
      const org = await organizationsService.create(tenantId, apiKeyId, { legalName: 'Verified Manufacturing Ltd' });
      const policy = await migratorPrisma.verificationPolicy.findUniqueOrThrow({
        where: { tenantId_name: { tenantId, name: 'org-kyb-registry' } },
      });
      // What resolveCaseActivity (apps/workflows) writes once
      // business_registry's own real provider call — proven in
      // verification-method.activity.spec.ts — resolves PASSED; recreated
      // directly here to prove this file's own read side in isolation,
      // same split apps/workflows' own attribute test documents.
      const kase = await migratorPrisma.verificationCase.create({
        data: {
          tenantId,
          subjectId: org.subjectId,
          policyId: policy.id,
          status: 'APPROVED',
          claimType: 'IDENTITY',
          level: 'REGISTRY_VERIFIED',
          resolvedAt: new Date(),
        },
      });

      const result = await organizationsService.getById(tenantId, apiKeyId, org.id);
      expect(result.isVerified).toBe(true);
      expect(result.verifiedLevel).toBe('REGISTRY_VERIFIED');
      expect(result.verifiedCaseId).toBe(kase.id);
    });
  });
});
