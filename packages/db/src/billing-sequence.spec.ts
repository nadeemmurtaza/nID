/**
 * Proves the billing invoice-number sequence is usable by the least-privilege
 * runtime role. 000_init's ALTER DEFAULT PRIVILEGES covers ON TABLES only, so
 * the sequence created in 20261031134340_billing_platform is invisible to
 * nid_app unless the migration also GRANTs it — without that grant, every
 * `nextval` Task 5's invoice numbering runs through APP_DATABASE_URL fails
 * with SQLSTATE 42501 permission denied. Requires a live Postgres with the
 * billing migration applied, so it's gated behind RUN_DB_TESTS like
 * apps/api/test/tenant-isolation.spec.ts. Run locally with:
 *
 *   RUN_DB_TESTS=true pnpm --filter @nid/db test
 */
import { createPrismaClient } from './index';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('billing invoice number sequence (nid_app grants)', () => {
  const prisma = createPrismaClient(process.env['APP_DATABASE_URL']);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('nextval on billing_invoice_number_seq succeeds and returns a positive number', async () => {
    const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('public.billing_invoice_number_seq') AS nextval`;
    const value = Number(rows[0]?.nextval);
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
  });
});
