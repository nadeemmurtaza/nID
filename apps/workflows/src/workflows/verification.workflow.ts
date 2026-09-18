import { proxyActivities, setHandler, condition } from '@temporalio/workflow';
import type { Duration } from '@temporalio/common';
import {
  submitMethodPayloadSignal,
  verificationStatusQuery,
  type VerificationWorkflowInput,
  type VerificationOutcome,
} from '@nid/workflow-contracts';
// Type-only: workflows run in a deterministic sandbox and must never import
// the activities module's runtime code (it does real I/O — Prisma, fetch,
// disk reads).
import type * as activities from '../activities/verification-method.activity';

const { startMethodActivity, completeMethodActivity, expireMethodActivity, resolveCaseActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});

/** Falls back for any method input.methodTimeouts doesn't name — see VerificationWorkflowInput's own comment. */
const DEFAULT_METHOD_TIMEOUT = '10 minutes';

/**
 * Runs a VerificationCase's policy — one or more methods, in order — as a
 * single workflow. Replaces Phase 0's otpVerificationWorkflow: a
 * single-method `["otp_sms"]` policy is the degenerate case of this same
 * loop (one iteration), not a separate workflow to keep in sync
 * (docs/HOUSE-RULES.md rule 5 and rule 1 — a method is a provider, and this
 * workflow never branches on which one it's running).
 *
 * Each method either resolves synchronously from start() (e.g. otp_sms
 * failing fast on a missing phone number) or goes pending and waits for the
 * subject's submission via submitMethodPayloadSignal. Any method coming
 * back FAILED or NEEDS_REVIEW stops the whole case there — later methods in
 * the policy never run against a case that's already lost or ambiguous.
 */
export async function verificationWorkflow(input: VerificationWorkflowInput): Promise<VerificationOutcome> {
  let outcome: VerificationOutcome = 'PENDING';
  let pendingSignal: { method: string; payload: Record<string, unknown> } | undefined;

  setHandler(submitMethodPayloadSignal, (signal) => {
    pendingSignal = signal;
  });
  setHandler(verificationStatusQuery, () => outcome);

  for (const method of input.methods) {
    const startResult = await startMethodActivity({
      caseId: input.caseId,
      tenantId: input.tenantId,
      subjectId: input.subjectId,
      method,
      input: input.methodInput[method] ?? {},
    });

    let status: 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';
    let raw: Record<string, unknown>;

    if (!startResult.pending) {
      status = startResult.status;
      raw = startResult.raw;
    } else {
      pendingSignal = undefined;
      // Duration's real type is a template-literal union (e.g. `${number} minutes`),
      // narrower than the plain `string` a workflow input necessarily carries
      // after crossing the Temporal client boundary — this cast is exactly
      // as safe as the same pattern apps/api already follows for
      // method-timeouts.ts's own return type, both sourced from the same
      // validated, predefined string literals.
      const timeout = (input.methodTimeouts?.[method] ?? DEFAULT_METHOD_TIMEOUT) as Duration;
      const gotSignalInTime = await condition(() => pendingSignal?.method === method, timeout);

      if (!gotSignalInTime) {
        await expireMethodActivity({ caseId: input.caseId, tenantId: input.tenantId, method });
        outcome = 'EXPIRED';
        await resolveCaseActivity({
          tenantId: input.tenantId,
          caseId: input.caseId,
          subjectId: input.subjectId,
          caseStatus: 'EXPIRED',
          decision: 'FAILED',
          raw: { reason: `${method}_expired` },
        });
        return outcome;
      }

      const completeResult = await completeMethodActivity({
        caseId: input.caseId,
        tenantId: input.tenantId,
        subjectId: input.subjectId,
        method,
        resultMeta: startResult.resultMeta,
        payload: pendingSignal!.payload,
      });
      status = completeResult.status;
      raw = completeResult.raw;
    }

    if (status === 'FAILED') {
      outcome = 'FAILED';
      await resolveCaseActivity({
        tenantId: input.tenantId,
        caseId: input.caseId,
        subjectId: input.subjectId,
        caseStatus: 'REJECTED',
        decision: 'FAILED',
        raw,
      });
      return outcome;
    }

    if (status === 'NEEDS_REVIEW') {
      outcome = 'NEEDS_REVIEW';
      await resolveCaseActivity({
        tenantId: input.tenantId,
        caseId: input.caseId,
        subjectId: input.subjectId,
        caseStatus: 'NEEDS_REVIEW',
        decision: 'NEEDS_REVIEW',
        raw,
      });
      return outcome;
    }

    // PASSED — fall through to the next method in the policy.
  }

  outcome = 'PASSED';
  await resolveCaseActivity({
    tenantId: input.tenantId,
    caseId: input.caseId,
    subjectId: input.subjectId,
    caseStatus: 'APPROVED',
    decision: 'PASSED',
    raw: {},
  });
  return outcome;
}
