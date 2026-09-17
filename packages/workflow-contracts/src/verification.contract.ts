import { defineSignal, defineQuery } from '@temporalio/workflow';

/**
 * Shared between apps/api (Temporal client, starts/signals workflows) and
 * apps/workflows (the worker that implements them) — Temporal's documented
 * pattern for keeping a client decoupled from a workflow's implementation
 * while staying typed. Never import apps/workflows' workflow implementation
 * files from apps/api; import only from here.
 *
 * Replaces the Phase 0 otp-verification.contract.ts: a policy with a single
 * `["otp_sms"]` method is the degenerate case of this same multi-method
 * workflow, not a separate implementation to keep in sync.
 */

export const VERIFICATION_WORKFLOW_TYPE = 'verificationWorkflow';

export interface VerificationWorkflowInput {
  caseId: string;
  tenantId: string;
  subjectId: string;
  /** VerificationPolicy.methods, in the order they run. */
  methods: string[];
  /**
   * Method-specific input needed at start() time, keyed by method key — e.g.
   * `{ otp_sms: { phone: '+1...' } }`. Methods with nothing to send at
   * start (document_ocr, liveness — the subject's next step is an upload,
   * not receiving anything) simply have no entry.
   */
  methodInput: Record<string, Record<string, unknown>>;
}

export type VerificationOutcome = 'PENDING' | 'PASSED' | 'FAILED' | 'NEEDS_REVIEW' | 'EXPIRED';

/**
 * Sent by apps/api when the subject completes whichever method the workflow
 * is currently waiting on: `{ submittedCode }` for otp_sms, or
 * `{ storageKey, contentType }` (a reference into @nid/storage, never the
 * raw bytes — see @nid/storage's header comment on why) for document_ocr /
 * liveness. The workflow ignores a signal whose `method` doesn't match the
 * step it's currently waiting on, rather than trusting the caller's
 * sequencing.
 */
export const submitMethodPayloadSignal = defineSignal<[{ method: string; payload: Record<string, unknown> }]>(
  'submitMethodPayload',
);

/**
 * Not consumed by apps/api today — case status is read from Postgres, the
 * durable source of truth, exactly as it was in Phase 0. Kept for parity
 * with the Phase 0 contract and for a future dashboard that wants live
 * in-flight workflow state without a DB round trip.
 */
export const verificationStatusQuery = defineQuery<VerificationOutcome>('verificationStatus');
