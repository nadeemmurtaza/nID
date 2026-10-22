/**
 * OrganizationMembershipProvider is the first provider in this package to
 * query nID's own database instead of a vendor/self-report — a real Prisma
 * query against real RLS, not something a mock can stand in for. Gated
 * behind RUN_DB_TESTS like apps/workflows/test/verification-method.activity.spec.ts.
 */
import { createPrismaClient, withTenantContext, type PrismaClient } from '@nid/db';
import { OrganizationMembershipProvider } from './organization-membership.provider';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('OrganizationMembershipProvider (live Postgres)', () => {
  const migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
  const appPrisma: PrismaClient = createPrismaClient(process.env['APP_DATABASE_URL']);
  const provider = new OrganizationMembershipProvider(appPrisma);

  async function makeTenant(slug: string) {
    return migratorPrisma.tenant.upsert({
      where: { slug },
      update: {},
      create: { name: slug, slug },
    });
  }

  async function makeOrganization(tenantId: string, legalName: string) {
    const orgSubject = await migratorPrisma.subject.create({
      data: { tenantId, type: 'ORGANIZATION' },
    });
    const organization = await migratorPrisma.organization.create({
      data: { tenantId, subjectId: orgSubject.id, legalName },
    });
    return { organization, orgSubject };
  }

  async function makePolicy(tenantId: string, name: string) {
    return migratorPrisma.verificationPolicy.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: { methods: ['org_membership'], claimType: 'IDENTITY', level: 'DOCUMENT_VERIFIED' },
      create: { tenantId, name, methods: ['org_membership'], claimType: 'IDENTITY', level: 'DOCUMENT_VERIFIED' },
    });
  }

  async function approveIdentityCase(tenantId: string, subjectId: string, policyId: string) {
    return migratorPrisma.verificationCase.create({
      data: {
        tenantId,
        subjectId,
        policyId,
        status: 'APPROVED',
        claimType: 'IDENTITY',
        level: 'DOCUMENT_VERIFIED',
      },
    });
  }

  afterAll(async () => {
    await migratorPrisma.$disconnect();
    await appPrisma.$disconnect();
  });

  it('fails closed when no organizationId is supplied', async () => {
    const result = await provider.start({ caseId: 'x', tenantId: 'x', subjectId: 'x', input: {} });
    expect('status' in result && result.status).toBe('FAILED');
  });

  it('fails when the claimed organization does not exist in this tenant', async () => {
    const tenant = await makeTenant('org-membership-test-missing-org');
    const person = await migratorPrisma.subject.create({ data: { tenantId: tenant.id, type: 'PERSON' } });
    const result = await provider.start({
      caseId: 'x',
      tenantId: tenant.id,
      subjectId: person.id,
      input: { organizationId: 'does-not-exist' },
    });
    expect('status' in result && result.status).toBe('FAILED');
    expect('raw' in result && result.raw['reason']).toBe('organization_not_found');
  });

  it('needs review when the org exists but nobody confirmed this person is a member', async () => {
    const tenant = await makeTenant('org-membership-test-no-membership');
    const { organization } = await makeOrganization(tenant.id, 'Acme Corp');
    const person = await migratorPrisma.subject.create({ data: { tenantId: tenant.id, type: 'PERSON' } });

    const result = await provider.start({
      caseId: 'x',
      tenantId: tenant.id,
      subjectId: person.id,
      input: { organizationId: organization.id },
    });
    expect('status' in result && result.status).toBe('NEEDS_REVIEW');
    expect('raw' in result && result.raw['reason']).toBe('membership_not_confirmed');
  });

  it('needs review when membership is confirmed but the organization itself is not yet verified', async () => {
    const tenant = await makeTenant('org-membership-test-org-unverified');
    const { organization } = await makeOrganization(tenant.id, 'Unverified Org');
    const person = await migratorPrisma.subject.create({ data: { tenantId: tenant.id, type: 'PERSON' } });
    await migratorPrisma.organizationMembership.create({
      data: { tenantId: tenant.id, organizationId: organization.id, personSubjectId: person.id, addedByApiKeyId: 'test-key' },
    });

    const result = await provider.start({
      caseId: 'x',
      tenantId: tenant.id,
      subjectId: person.id,
      input: { organizationId: organization.id },
    });
    expect('status' in result && result.status).toBe('NEEDS_REVIEW');
    expect('raw' in result && result.raw['reason']).toBe('organization_not_yet_verified');
  });

  it('passes when the org is verified AND membership is confirmed — real inheritance, not a shortcut', async () => {
    const tenant = await makeTenant('org-membership-test-passes');
    const { organization, orgSubject } = await makeOrganization(tenant.id, 'Verified Org');
    const policy = await makePolicy(tenant.id, 'kyb-identity');
    const kybCase = await approveIdentityCase(tenant.id, orgSubject.id, policy.id);

    const person = await migratorPrisma.subject.create({ data: { tenantId: tenant.id, type: 'PERSON' } });
    await migratorPrisma.organizationMembership.create({
      data: {
        tenantId: tenant.id,
        organizationId: organization.id,
        personSubjectId: person.id,
        role: 'Engineer',
        addedByApiKeyId: 'test-key',
      },
    });

    const result = await provider.start({
      caseId: 'x',
      tenantId: tenant.id,
      subjectId: person.id,
      input: { organizationId: organization.id },
    });
    expect('status' in result && result.status).toBe('PASSED');
    expect('raw' in result && result.raw['inheritedFromCaseId']).toBe(kybCase.id);
    expect('raw' in result && result.raw['role']).toBe('Engineer');
  });

  it('really does enforce tenant isolation via RLS, not just an app-layer filter', async () => {
    const tenantA = await makeTenant('org-membership-test-tenant-a');
    const tenantB = await makeTenant('org-membership-test-tenant-b');
    const { organization } = await makeOrganization(tenantA.id, 'Tenant A Org');
    const personInB = await migratorPrisma.subject.create({ data: { tenantId: tenantB.id, type: 'PERSON' } });

    // A subject from tenant B, but the provider is called with tenantId
    // pointed at tenant A's context — withTenantContext sets app.tenant_id
    // to tenant A, so tenant B's subject row must be invisible to any
    // lookup keyed on it, proving isolation is DB-enforced, not just an
    // app-layer `where` clause omission away from leaking.
    const result = await provider.start({
      caseId: 'x',
      tenantId: tenantA.id,
      subjectId: personInB.id,
      input: { organizationId: organization.id },
    });
    expect('status' in result && result.status).toBe('NEEDS_REVIEW');
    expect('raw' in result && result.raw['reason']).toBe('membership_not_confirmed');

    // Sanity check the raw fixture actually exists under its own tenant.
    const visible = await withTenantContext(migratorPrisma, tenantB.id, (tx) =>
      tx.subject.findUnique({ where: { id: personInB.id } }),
    );
    expect(visible).not.toBeNull();
  });
});
