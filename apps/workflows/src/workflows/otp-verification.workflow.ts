import { proxyActivities, setHandler, condition } from '@temporalio/workflow';
import {
  submitOtpCodeSignal,
  otpStatusQuery,
  type OtpVerificationWorkflowInput,
  type OtpVerificationOutcome,
} from '@nid/workflow-contracts';
// Type-only: workflows run in a deterministic sandbox and must never import
// the activities module's runtime code (it does real I/O — Prisma, fetch).
import type * as activities from '../activities/otp-sms.activity';

const { sendOtpActivity, verifyOtpActivity, expireOtpActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});

const CODE_EXPIRY = '10 minutes';

export async function otpVerificationWorkflow(input: OtpVerificationWorkflowInput): Promise<OtpVerificationOutcome> {
  let outcome: OtpVerificationOutcome = 'PENDING';
  let submittedCode: string | undefined;

  setHandler(submitOtpCodeSignal, (code) => {
    submittedCode = code;
  });
  setHandler(otpStatusQuery, () => outcome);

  const { codeHash } = await sendOtpActivity(input);

  const gotSignalInTime = await condition(() => submittedCode !== undefined, CODE_EXPIRY);
  if (!gotSignalInTime) {
    outcome = 'EXPIRED';
    await expireOtpActivity(input);
    return outcome;
  }

  const result = await verifyOtpActivity({
    caseId: input.caseId,
    tenantId: input.tenantId,
    subjectId: input.subjectId,
    codeHash,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    submittedCode: submittedCode!,
  });

  outcome = result.status;
  return outcome;
}
