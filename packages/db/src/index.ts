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
  fn: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}
