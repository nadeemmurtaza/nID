import { defineSignal, defineQuery } from '@temporalio/workflow';

/**
 * Shared between apps/api (Temporal client, starts/signals workflows) and
 * apps/workflows (the worker that implements them) — Temporal's documented
 * pattern for keeping a client decoupled from a workflow's implementation
 * while staying typed. Never import apps/workflows' workflow implementation
 * files from apps/api; import only from here.
 */

export const OTP_VERIFICATION_WORKFLOW_TYPE = 'otpVerificationWorkflow';

export interface OtpVerificationWorkflowInput {
  caseId: string;
  tenantId: string;
  subjectId: string;
  phone: string;
}

export type OtpVerificationOutcome = 'PENDING' | 'PASSED' | 'FAILED' | 'EXPIRED';

/** Sent by apps/api when the subject submits the code they received. */
export const submitOtpCodeSignal = defineSignal<[string]>('submitOtpCode');

/** Polled by apps/api's GET /v1/verification-cases/:id until it leaves PENDING. */
export const otpStatusQuery = defineQuery<OtpVerificationOutcome>('otpStatus');
