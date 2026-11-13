import type { LedgerAccountKind, LedgerTransactionType, TransactionClient } from '@nid/db';
import { assertCurrency, assertPositiveMinor, sumMinor } from './money';
import { BillingError, UnbalancedLedgerError } from './errors';

export interface LedgerLineInput {
  kind: LedgerAccountKind;
  /** Only REVENUE/DEFERRED_REVENUE are service-attributed; everything else is platform-wide per tenant. */
  serviceId?: string | null;
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: bigint;
}

export interface PostLedgerTransactionInput {
  tenantId: string;
  type: LedgerTransactionType;
  refType: string;
  refId: string;
  /**
   * One currency for the whole transaction, and `LedgerLineInput` carries no
   * currency of its own because `LedgerEntry` has no currency column: the
   * entries inherit this value from the parent aggregate.
   */
  currency: string;
  occurredAt?: Date;
  lines: LedgerLineInput[];
}

export function ledgerScopeKey(
  tenantId: string,
  kind: LedgerAccountKind,
  currency: string,
  serviceId?: string | null,
): string {
  const service = serviceId ? `s:${serviceId}:` : '';
  return `t:${tenantId}:${service}${kind}:${currency}`;
}

/**
 * The invariant the ledger exists to hold (spec §5.2, invariant 1): a
 * transaction is a closed system. Checked before any write, because a
 * half-posted transaction is worse than a rejected one — there is no
 * in-transaction rollback of a ledger entry that is visible to a report.
 */
export function assertBalanced(lines: readonly LedgerLineInput[]): void {
  if (lines.length < 2) {
    throw new UnbalancedLedgerError('A ledger transaction needs at least two lines.');
  }
  for (const line of lines) {
    assertPositiveMinor(line.amountMinor, `Ledger line ${line.kind}`);
  }

  const debits = sumMinor(lines.filter((line) => line.direction === 'DEBIT').map((line) => line.amountMinor));
  const credits = sumMinor(lines.filter((line) => line.direction === 'CREDIT').map((line) => line.amountMinor));
  if (debits !== credits) {
    throw new UnbalancedLedgerError(`Ledger transaction is unbalanced: debits ${debits} != credits ${credits}.`);
  }
}

/**
 * Posts one atomic transaction. Accounts are found or created by scopeKey,
 * entries are append-only, and every row carries tenantId so RLS applies to
 * the ledger exactly as it does to invoices (spec D4 + house rule 2).
 *
 * Takes the caller's transaction client rather than opening one, so a payment
 * settlement, its credit movement and its audit row commit together or not at
 * all — spec §4.1.
 */
export async function postLedgerTransaction(
  tx: TransactionClient,
  input: PostLedgerTransactionInput,
): Promise<{ transactionId: string }> {
  assertCurrency(input.currency);
  assertBalanced(input.lines);

  const transaction = await tx.ledgerTransaction.create({
    data: {
      tenantId: input.tenantId,
      type: input.type,
      refType: input.refType,
      refId: input.refId,
      currency: input.currency,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });

  for (const line of input.lines) {
    const scopeKey = ledgerScopeKey(input.tenantId, line.kind, input.currency, line.serviceId);
    const account = await tx.ledgerAccount.upsert({
      where: { scopeKey },
      update: {},
      create: {
        tenantId: input.tenantId,
        serviceId: line.serviceId ?? null,
        kind: line.kind,
        currency: input.currency,
        scopeKey,
      },
    });
    // Currency lives in the key, so a PKR posting can never select the tenant's
    // USD account — unless a row's key and column were made to disagree. Posting
    // into that account would file money under a currency the schema cannot show.
    if (account.currency !== input.currency) {
      throw new BillingError(
        `Ledger account "${scopeKey}" is held in ${account.currency}, not ${input.currency}.`,
      );
    }
    await tx.ledgerEntry.create({
      data: {
        tenantId: input.tenantId,
        transactionId: transaction.id,
        accountId: account.id,
        direction: line.direction,
        amountMinor: line.amountMinor,
      },
    });
  }

  return { transactionId: transaction.id };
}
