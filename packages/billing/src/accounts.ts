import type { BillingAccount, TransactionClient } from '@nid/db';
import { assertCurrency } from './money';

/**
 * The billing account IS the tenant (spec D3) — one per tenant, created on
 * first billing action rather than by a migration backfill, so a tenant that
 * never buys anything never has a financial row.
 */
export async function ensureBillingAccount(
  tx: TransactionClient,
  tenantId: string,
  currency = 'PKR',
): Promise<BillingAccount> {
  assertCurrency(currency);
  return tx.billingAccount.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, currency },
  });
}

/**
 * Deliberately read-only: charge flows must not mint an account as a side
 * effect of a lookup. Verification's credit debit uses this so a tenant
 * with no billing relationship stays entirely out of the billing system.
 */
export async function getBillingAccount(tx: TransactionClient, tenantId: string): Promise<BillingAccount | null> {
  return tx.billingAccount.findUnique({ where: { tenantId } });
}
