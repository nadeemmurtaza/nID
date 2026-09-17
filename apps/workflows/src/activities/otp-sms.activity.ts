import { createPrismaClient, withTenantContext } from '@nid/db';
import { buildVerificationProviderRegistry } from '@nid/verification-providers';
import { signWebhookPayload } from '@nid/shared-types';
import type { OtpVerificationWorkflowInput } from '@nid/workflow-contracts';

/**
 * Activities do I/O; workflows don't (Temporal workflows run in a
 * deterministic sandbox with no Node APIs). This file is imported by
 * worker.ts as a plain module, and imported *type-only* by the workflow —
 * see workflows/otp-verification.workflow.ts.
 */

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

// Module-level singletons: one Prisma connection and one provider registry
// per worker process, reused across activity invocations.
const prisma = createPrismaClient(requiredEnv('APP_DATABASE_URL'));
const registry = buildVerificationProviderRegistry({
  allowlist: process.env['VERIFICATION_METHODS'] ?? '',
  otpSmsDevMode: process.env['OTP_SMS_DEV_MODE'] === 'true',
});

function getOtpProvider() {
  const provider = registry.get('otp_sms');
  if (!provider) {
    throw new Error('otp_sms provider not enabled — check VERIFICATION_METHODS.');
  }
  return provider;
}

export async function sendOtpActivity(input: OtpVerificationWorkflowInput): Promise<{ codeHash: string }> {
  const provider = getOtpProvider();
  const result = await provider.start({
    caseId: input.caseId,
    tenantId: input.tenantId,
    subjectId: input.subjectId,
    input: { phone: input.phone },
  });

  if (!('pending' in result) || result.pending !== true) {
    throw new Error('otp_sms.start() did not return a pending result — unexpected in Phase 0.');
  }
  const codeHash = result.resultMeta?.['codeHash'];
  if (typeof codeHash !== 'string') {
    throw new Error('otp_sms.start() did not return a codeHash in resultMeta.');
  }

  await withTenantContext(prisma, input.tenantId, async (tx) => {
    await tx.verificationMethodAttempt.updateMany({
      where: { caseId: input.caseId, method: 'otp_sms' },
      data: { resultMeta: { codeHash } },
    });
    await tx.verificationCase.update({ where: { id: input.caseId }, data: { status: 'IN_REVIEW' } });
  });

  return { codeHash };
}

export interface VerifyOtpActivityInput {
  caseId: string;
  tenantId: string;
  subjectId: string;
  codeHash: string;
  submittedCode: string;
}

export async function verifyOtpActivity(input: VerifyOtpActivityInput): Promise<{ status: 'PASSED' | 'FAILED' }> {
  const provider = getOtpProvider();
  if (!provider.handleCallback) {
    throw new Error('otp_sms provider has no handleCallback.');
  }

  const result = await provider.handleCallback({
    submittedCode: input.submittedCode,
    expectedCodeHash: input.codeHash,
  });
  const status = result.status === 'PASSED' ? 'PASSED' : 'FAILED';

  await resolveCase({
    tenantId: input.tenantId,
    caseId: input.caseId,
    subjectId: input.subjectId,
    caseStatus: status === 'PASSED' ? 'APPROVED' : 'REJECTED',
    attemptStatus: status,
    raw: result.raw,
  });

  return { status };
}

export async function expireOtpActivity(input: OtpVerificationWorkflowInput): Promise<void> {
  await resolveCase({
    tenantId: input.tenantId,
    caseId: input.caseId,
    subjectId: input.subjectId,
    caseStatus: 'EXPIRED',
    attemptStatus: 'FAILED',
    raw: { reason: 'otp_expired' },
  });
}

interface ResolveCaseInput {
  tenantId: string;
  caseId: string;
  subjectId: string;
  caseStatus: 'APPROVED' | 'REJECTED' | 'EXPIRED';
  attemptStatus: 'PASSED' | 'FAILED';
  raw: Record<string, unknown>;
}

async function resolveCase(input: ResolveCaseInput): Promise<void> {
  const tenant = await withTenantContext(prisma, input.tenantId, async (tx) => {
    await tx.verificationMethodAttempt.updateMany({
      where: { caseId: input.caseId, method: 'otp_sms' },
      data: { status: input.attemptStatus, completedAt: new Date() },
    });
    await tx.verificationCase.update({
      where: { id: input.caseId },
      data: { status: input.caseStatus, decision: input.attemptStatus, resolvedAt: new Date() },
    });
    // Written by SYSTEM (the workflow), not API_KEY — docs/HOUSE-RULES.md
    // rule 3 requires this on every Subject read, and this is a read (the
    // case/attempt rows just fetched) as much as a write.
    await tx.auditLogEntry.create({
      data: {
        tenantId: input.tenantId,
        actorType: 'SYSTEM',
        action: 'verification_case.resolve',
        subjectId: input.subjectId,
        caseId: input.caseId,
      },
    });
    return tx.tenant.findUnique({ where: { id: input.tenantId } });
  });

  if (tenant?.webhookUrl && tenant.webhookSecretPlaintext) {
    await deliverWebhook(tenant.webhookUrl, tenant.webhookSecretPlaintext, {
      caseId: input.caseId,
      tenantId: input.tenantId,
      subjectId: input.subjectId,
      status: input.caseStatus,
      raw: input.raw,
    });
  }
}

async function deliverWebhook(url: string, secret: string, payload: Record<string, unknown>): Promise<void> {
  const body = JSON.stringify(payload);
  const timestampMs = Date.now();
  const signature = signWebhookPayload(secret, body, timestampMs);

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-nid-timestamp': String(timestampMs),
        'x-nid-signature': signature,
      },
      body,
    });
  } catch (err) {
    // Webhook delivery failing must not fail the activity that already
    // committed the case's terminal state — Phase 1 adds a retry/outbox for
    // this; Phase 0 logs and moves on.
    console.error(`Failed to deliver webhook to ${url}`, err);
  }
}
