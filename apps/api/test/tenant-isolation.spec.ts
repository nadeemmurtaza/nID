/**
 * Proves docs/HOUSE-RULES.md rule 2: RLS blocks cross-tenant reads at the
 * database, not just in application code. Requires a live Postgres with
 * migrations + the seed applied (`pnpm db:migrate && pnpm db:seed`), so it's
 * gated behind RUN_DB_TESTS — this sandbox has no Docker daemon and could
 * not run it while building this scaffold (see README.md). Run locally with:
 *
 *   RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { createPrismaClient, withTenantContext } from '@nid/db';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('tenant isolation (RLS)', () => {
  const prisma = createPrismaClient(process.env['APP_DATABASE_URL']);
  let tenantAId: string;
  let tenantBId: string;
  let subjectAId: string;

  beforeAll(async () => {
    const migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    const tenantA = await migratorPrisma.tenant.upsert({
      where: { slug: 'tenant-a' },
      update: {},
      create: { name: 'Tenant A', slug: 'tenant-a' },
    });
    const tenantB = await migratorPrisma.tenant.upsert({
      where: { slug: 'tenant-b' },
      update: {},
      create: { name: 'Tenant B', slug: 'tenant-b' },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const subjectA = await migratorPrisma.subject.create({
      data: { tenantId: tenantAId, type: 'PERSON', givenName: 'Alice' },
    });
    subjectAId = subjectA.id;
    await migratorPrisma.$disconnect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('a session scoped to tenant B cannot see tenant A\'s subject, even with an unscoped findUnique', async () => {
    const found = await withTenantContext(prisma, tenantBId, (tx) =>
      // Deliberately no `where: { tenantId }` — this is exactly the query
      // shape apps/api/src/modules/subjects/subjects.service.ts uses, and
      // RLS (not this query) is what must stop it from crossing tenants.
      tx.subject.findUnique({ where: { id: subjectAId } }),
    );
    expect(found).toBeNull();
  });

  it('a session scoped to tenant A can see its own subject', async () => {
    const found = await withTenantContext(prisma, tenantAId, (tx) =>
      tx.subject.findUnique({ where: { id: subjectAId } }),
    );
    expect(found?.id).toBe(subjectAId);
  });

  it('a session with no tenant context set sees nothing (fail closed)', async () => {
    // No withTenantContext at all: app.tenant_id was never set on this connection.
    const found = await prisma.subject.findUnique({ where: { id: subjectAId } });
    expect(found).toBeNull();
  });
});
