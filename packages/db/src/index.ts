import { PrismaClient } from '../generated/client';

export * from '../generated/client';

/**
 * `datasourceUrl` defaults to `DATABASE_URL` (the migration/seed role, which
 * bypasses RLS). apps/api must pass `APP_DATABASE_URL` explicitly — the
 * least-privilege role RLS is actually enforced against. See
 * prisma/migrations/000_init/migration.sql for why the two roles exist.
 */
export function createPrismaClient(datasourceUrl?: string): PrismaClient {
  return new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);
}

export type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Runs `fn` inside a transaction with the Postgres session variable
 * `app.tenant_id` set for that transaction only (`set_config(..., true)` is
 * the parameterized equivalent of `SET LOCAL`, which does not accept bind
 * parameters). Every RLS policy in migrations/000_init/migration.sql reads
 * this variable — a caller that skips this wrapper sees zero rows, not
 * someone else's, because the policies fail closed on an unset variable.
 *
 * This is the one place `tenantId` should ever reach the database from
 * request-scoped code. See apps/api/src/core/db/prisma.service.ts for the
 * per-request usage and docs/HOUSE-RULES.md rule 2.
 */
export async function withTenantContext<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

/**
 * Runs `fn` with `app.billing_admin` set, which is the only way the catalog
 * policies' write branch opens. This is deliberately not a general-purpose
 * escape hatch: `catalog_write` grants INSERT/UPDATE/DELETE on BillingService,
 * Plan and BillingServiceCredential and nothing else, so holding it cannot
 * reach a tenant's money. `apps/api`'s admin path is the only caller —
 * `withTenantContext` still has to be nested inside it for anything
 * tenant-scoped, because this sets no tenant.
 */
export async function withBillingAdminContext<T>(
  prisma: PrismaClient,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.billing_admin', 'on', true)`;
    return fn(tx);
  });
}
