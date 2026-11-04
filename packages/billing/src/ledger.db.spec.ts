import {
  createPrismaClient,
  withTenantContext,
  type PrismaClient,
} from '@nid/db';
import { postLedgerTransaction } from './ledger';
import { ensureBillingAccount } from './accounts';
import { BillingError } from './errors';

const runDb = process.env['RUN_DB_TESTS'] === 'true' ? describe : describe.skip;

/**
 * Every ledger write and read here goes through the least-privilege `nid_app`
 * role, so a green run proves the ledger works under RLS rather than around it.
 * Tenants and catalog rows are created through `DATABASE_URL` because RLS
 * correctly refuses those inserts without an admin context — but that
 * connection never stands in for `prisma` and never carries an isolation
 * assertion: it is a superuser, and with it every assertion below would pass
 * without Postgres enforcing a single policy.
 */
runDb('ledger against real Postgres (nid_app role)', () => {
  let prisma: PrismaClient;
  let superuser: PrismaClient;
  let tenantId: string;
  let otherTenantId: string;
  let ready = false;
  const suffix = Date.now().toString(36);
  const serviceIds: string[] = [];

  beforeAll(async () => {
    const appUrl = process.env['APP_DATABASE_URL'];
    if (!appUrl) {
      throw new Error(
        'ledger.db.spec.ts needs APP_DATABASE_URL — see packages/db/sql/001-app-role-bootstrap.sql.',
      );
    }
    const migratorUrl = process.env['DATABASE_URL'];
    if (!migratorUrl) {
      throw new Error(
        'ledger.db.spec.ts needs DATABASE_URL: tenants and catalog rows are created outside RLS, and there is no fallback to the app role for them.',
      );
    }

    prisma = createPrismaClient(appUrl);
    superuser = createPrismaClient(migratorUrl);

    const [role] = await prisma.$queryRaw<{ usr: string; bypass: boolean; is_super: boolean }[]>`
      SELECT current_user AS usr,
             (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
             (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_super`;
    if (!role || role.bypass || role.is_super) {
      throw new Error(
        `ledger.db.spec.ts must connect as a role RLS applies to, but APP_DATABASE_URL connects as "${role?.usr}" ` +
          `(bypassrls=${role?.bypass}, super=${role?.is_super}) — every isolation assertion below would pass vacuously.`,
      );
    }

    tenantId = (await superuser.tenant.create({ data: { name: `ledger ${suffix}`, slug: `ledger-${suffix}` } })).id;
    otherTenantId = (await superuser.tenant.create({
      data: { name: `ledger other ${suffix}`, slug: `ledger-other-${suffix}` },
    })).id;
    ready = true;
  });

  afterAll(async () => {
    if (ready) {
      // LedgerEntry -> LedgerAccount is ON DELETE RESTRICT, so the rows go in
      // dependency order rather than relying on Tenant's cascades.
      for (const id of [tenantId, otherTenantId]) {
        await superuser.ledgerEntry.deleteMany({ where: { tenantId: id } });
        await superuser.ledgerTransaction.deleteMany({ where: { tenantId: id } });
        await superuser.ledgerAccount.deleteMany({ where: { tenantId: id } });
        await superuser.billingAccount.deleteMany({ where: { tenantId: id } });
        await superuser.tenant.delete({ where: { id } });
      }
      // BillingService -> LedgerAccount is RESTRICT too, so a service can only
      // be deleted after the tenant's accounts that point at it are gone.
      for (const id of serviceIds) {
        await superuser.billingService.delete({ where: { id } });
      }
    }
    const clients: Array<PrismaClient | undefined> = [prisma, superuser];
    await Promise.all(clients.map((client) => client?.$disconnect()));
  });

  it('writes one transaction whose entries sum to zero, creating accounts on first use', async () => {
    const result = await withTenantContext(prisma, tenantId, (tx) =>
      postLedgerTransaction(tx, {
        tenantId,
        type: 'CREDIT_TOPUP',
        refType: 'payment_intent',
        refId: `intent_${suffix}`,
        currency: 'PKR',
        lines: [
          { kind: 'PSP_CLEARING', direction: 'DEBIT', amountMinor: 11800n },
          { kind: 'CUSTOMER_CREDITS', direction: 'CREDIT', amountMinor: 10000n },
          { kind: 'TAX_PAYABLE', direction: 'CREDIT', amountMinor: 1800n },
        ],
      }),
    );

    const entries = await withTenantContext(prisma, tenantId, (tx) =>
      tx.ledgerEntry.findMany({ where: { transactionId: result.transactionId }, include: { account: true } }),
    );

    expect(entries).toHaveLength(3);
    const total = entries.reduce(
      (sum, entry) => sum + (entry.direction === 'DEBIT' ? entry.amountMinor : -entry.amountMinor),
      0n,
    );
    expect(total).toBe(0n);
    expect(new Set(entries.map((entry) => entry.account.scopeKey))).toEqual(
      new Set([`t:${tenantId}:PSP_CLEARING:PKR`, `t:${tenantId}:CUSTOMER_CREDITS:PKR`, `t:${tenantId}:TAX_PAYABLE:PKR`]),
    );
  });

  it('reuses the same account row for a second posting instead of duplicating it', async () => {
    await withTenantContext(prisma, tenantId, (tx) =>
      postLedgerTransaction(tx, {
        tenantId,
        type: 'FEE',
        refType: 'settlement_record',
        refId: `stl_${suffix}`,
        currency: 'PKR',
        lines: [
          { kind: 'PSP_FEES', direction: 'DEBIT', amountMinor: 236n },
          { kind: 'PSP_CLEARING', direction: 'CREDIT', amountMinor: 236n },
        ],
      }),
    );

    const clearingAccounts = await withTenantContext(prisma, tenantId, (tx) =>
      tx.ledgerAccount.findMany({ where: { tenantId, kind: 'PSP_CLEARING' } }),
    );
    expect(clearingAccounts).toHaveLength(1);
  });

  it('creates the tenant-scoped accounts a revenue line needs', async () => {
    const service = await superuser.billingService.create({
      data: { key: `ledger-svc-${suffix}`, name: 'Ledger Test', ownerRepo: 'nID' },
    });
    serviceIds.push(service.id);

    await withTenantContext(prisma, tenantId, (tx) =>
      postLedgerTransaction(tx, {
        tenantId,
        type: 'CREDIT_USAGE',
        refType: 'verification_case',
        refId: `case_${suffix}`,
        currency: 'PKR',
        lines: [
          { kind: 'CUSTOMER_CREDITS', direction: 'DEBIT', amountMinor: 2500n },
          { kind: 'REVENUE', serviceId: service.id, direction: 'CREDIT', amountMinor: 2500n },
        ],
      }),
    );

    const revenue = await withTenantContext(prisma, tenantId, (tx) =>
      tx.ledgerAccount.findFirst({ where: { tenantId, kind: 'REVENUE', serviceId: service.id } }),
    );
    expect(revenue?.scopeKey).toBe(`t:${tenantId}:s:${service.id}:REVENUE:PKR`);
  });

  it('leaves the balance cache alone — only credits.ts may move it', async () => {
    const account = await withTenantContext(prisma, tenantId, async (tx) => {
      const created = await ensureBillingAccount(tx, tenantId);
      await postLedgerTransaction(tx, {
        tenantId,
        type: 'CREDIT_TOPUP',
        refType: 'payment_intent',
        refId: `intent_cache_${suffix}`,
        currency: 'PKR',
        lines: [
          { kind: 'PSP_CLEARING', direction: 'DEBIT', amountMinor: 500n },
          { kind: 'CUSTOMER_CREDITS', direction: 'CREDIT', amountMinor: 500n },
        ],
      });
      return created;
    });
    expect(account.creditBalanceMinor).toBe(0n);
  });

  it('gives one account kind in another currency its own row', async () => {
    await withTenantContext(prisma, tenantId, (tx) =>
      postLedgerTransaction(tx, {
        tenantId,
        type: 'CREDIT_TOPUP',
        refType: 'payment_intent',
        refId: `intent_usd_${suffix}`,
        currency: 'USD',
        lines: [
          { kind: 'PSP_CLEARING', direction: 'DEBIT', amountMinor: 1000n },
          { kind: 'CUSTOMER_CREDITS', direction: 'CREDIT', amountMinor: 1000n },
        ],
      }),
    );

    const creditsAccounts = await withTenantContext(prisma, tenantId, (tx) =>
      tx.ledgerAccount.findMany({ where: { tenantId, kind: 'CUSTOMER_CREDITS' }, orderBy: { currency: 'asc' } }),
    );
    expect(creditsAccounts.map((account) => account.currency)).toEqual(['PKR', 'USD']);
    expect(creditsAccounts.map((account) => account.scopeKey)).toEqual([
      `t:${tenantId}:CUSTOMER_CREDITS:PKR`,
      `t:${tenantId}:CUSTOMER_CREDITS:USD`,
    ]);
  });

  /**
   * `LedgerEntry` has no currency column — it inherits the parent transaction's —
   * so a posting whose account row disagrees about currency would file a PKR
   * movement under a USD account and no report could tell. Rejected, with
   * nothing left behind.
   */
  it('refuses a posting whose account row carries another currency, and writes nothing', async () => {
    const refId = `intent_mixed_${suffix}`;
    const rogueScopeKey = `t:${tenantId}:ADJUSTMENTS:PKR`;
    await superuser.ledgerAccount.create({
      data: { tenantId, kind: 'ADJUSTMENTS', currency: 'USD', scopeKey: rogueScopeKey },
    });

    const posting = withTenantContext(prisma, tenantId, (tx) =>
      postLedgerTransaction(tx, {
        tenantId,
        type: 'ADJUSTMENT',
        refType: 'payment_intent',
        refId,
        currency: 'PKR',
        lines: [
          { kind: 'ADJUSTMENTS', direction: 'DEBIT', amountMinor: 100n },
          { kind: 'PSP_CLEARING', direction: 'CREDIT', amountMinor: 100n },
        ],
      }),
    );
    await expect(posting).rejects.toThrow(BillingError);
    await expect(posting).rejects.toThrow(/is held in USD, not PKR/);

    const leftovers = await withTenantContext(prisma, tenantId, (tx) =>
      tx.ledgerTransaction.findMany({ where: { refId }, include: { entries: true } }),
    );
    expect(leftovers).toHaveLength(0);
  });

  it('refuses a negative line amount before anything is written', async () => {
    const refId = `intent_negative_${suffix}`;
    await expect(
      withTenantContext(prisma, tenantId, (tx) =>
        postLedgerTransaction(tx, {
          tenantId,
          type: 'CREDIT_TOPUP',
          refType: 'payment_intent',
          refId,
          currency: 'PKR',
          lines: [
            { kind: 'PSP_CLEARING', direction: 'DEBIT', amountMinor: -11800n },
            { kind: 'CUSTOMER_CREDITS', direction: 'CREDIT', amountMinor: -11800n },
          ],
        }),
      ),
    ).rejects.toThrow(/positive/);

    const rows = await withTenantContext(prisma, tenantId, (tx) =>
      tx.ledgerTransaction.findMany({ where: { refId } }),
    );
    expect(rows).toHaveLength(0);
  });

  it('refuses a posting made outside a tenant context', async () => {
    const refId = `intent_no_context_${suffix}`;
    await expect(
      prisma.$transaction((tx) =>
        postLedgerTransaction(tx, {
          tenantId,
          type: 'FEE',
          refType: 'settlement_record',
          refId,
          currency: 'PKR',
          lines: [
            { kind: 'PSP_FEES', direction: 'DEBIT', amountMinor: 10n },
            { kind: 'PSP_CLEARING', direction: 'CREDIT', amountMinor: 10n },
          ],
        }),
      ),
    ).rejects.toThrow(/violates row-level security policy/);

    const rows = await withTenantContext(prisma, tenantId, (tx) =>
      tx.ledgerTransaction.findMany({ where: { refId } }),
    );
    expect(rows).toHaveLength(0);
  });

  it("hides one tenant's ledger from another, even for an unscoped read", async () => {
    const mine = await withTenantContext(prisma, tenantId, (tx) =>
      tx.ledgerEntry.findMany({ where: { tenantId } }),
    );
    expect(mine.length).toBeGreaterThan(0);

    // No `where: { tenantId }` at all: RLS is the only thing that can make this
    // come back empty, so a superuser connection could not stand in for `prisma`.
    const theirs = await withTenantContext(prisma, otherTenantId, (tx) => tx.ledgerEntry.findMany({}));
    expect(theirs).toHaveLength(0);

    const theirAccounts = await withTenantContext(prisma, otherTenantId, (tx) => tx.ledgerAccount.findMany({}));
    expect(theirAccounts).toHaveLength(0);
  });
});
