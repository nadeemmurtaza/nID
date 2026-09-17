import { createPrismaClient, withTenantContext, Prisma } from '@nid/db';
import { buildVerificationProviderRegistry, type VerificationResult, type PendingResult } from '@nid/verification-providers';
import { LocalStorageDriver } from '@nid/storage';
import { signWebhookPayload } from '@nid/shared-types';

/**
 * Activities do I/O; workflows don't (Temporal workflows run in a
 * deterministic sandbox with no Node APIs). This file replaces Phase 0's
 * otp-sms.activity.ts: one set of method-agnostic activities, dispatching
 * to whichever VerificationMethodProvider the workflow names, instead of
 * one activity file per method (docs/HOUSE-RULES.md rule 1 — the provider
 * is the extension point, not a new activity).
 */

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

// Module-level singletons: one Prisma connection, one provider registry, and
// one storage driver per worker process, reused across activity invocations.
const prisma = createPrismaClient(requiredEnv('APP_DATABASE_URL'));
const registry = buildVerificationProviderRegistry({
  allowlist: process.env['VERIFICATION_METHODS'] ?? '',
  otpSmsDevMode: process.env['OTP_SMS_DEV_MODE'] === 'true',
  documentOcrDevMode: process.env['DOCUMENT_OCR_DEV_MODE'] === 'true',
  livenessDevMode: process.env['LIVENESS_DEV_MODE'] === 'true',
  claimDocumentDevMode: process.env['CLAIM_DOCUMENT_DEV_MODE'] === 'true',
  registryCheckDevMode: process.env['REGISTRY_CHECK_DEV_MODE'] === 'true',
  educationRegistryConfig: {
    apiUrl: process.env['EDUCATION_REGISTRY_API_URL'],
    apiKey: process.env['EDUCATION_REGISTRY_API_KEY'],
  },
  employmentRegistryConfig: {
    apiUrl: process.env['EMPLOYMENT_REGISTRY_API_URL'],
    apiKey: process.env['EMPLOYMENT_REGISTRY_API_KEY'],
  },
});
// Local-disk only today — apps/api writes an upload here, this Activity
// reads it back, both pointed at the same LOCAL_STORAGE_DIR. See
// @nid/storage's header comment for why that's a dev/single-host
// constraint, not a production one.
const storage = new LocalStorageDriver(requiredEnv('LOCAL_STORAGE_DIR'));

function getProvider(method: string) {
  const provider = registry.get(method);
  if (!provider) {
    throw new Error(`"${method}" provider not enabled — check VERIFICATION_METHODS.`);
  }
  return provider;
}

function isPending(result: VerificationResult | PendingResult): result is PendingResult {
  return 'pending' in result && result.pending === true;
}

export interface StartMethodActivityInput {
  caseId: string;
  tenantId: string;
  subjectId: string;
  method: string;
  input: Record<string, unknown>;
}

export type StartMethodActivityResult =
  | { pending: true; resultMeta: Record<string, unknown> }
  | { pending: false; status: 'PASSED' | 'FAILED' | 'NEEDS_REVIEW'; raw: Record<string, unknown> };

/**
 * Runs a method's start() and persists the resulting attempt state. May
 * move the case from PENDING to IN_REVIEW (awaiting the subject's action on
 * this method) — a non-terminal progress marker, not a resolution. Only
 * resolveCaseActivity ever sets a terminal case status; the workflow, which
 * knows the full method sequence, decides when that's warranted
 * (docs/HOUSE-RULES.md rule 5).
 */
export async function startMethodActivity(input: StartMethodActivityInput): Promise<StartMethodActivityResult> {
  const provider = getProvider(input.method);
  const result = await provider.start({
    caseId: input.caseId,
    tenantId: input.tenantId,
    subjectId: input.subjectId,
    input: input.input,
  });

  if (isPending(result)) {
    const resultMeta = result.resultMeta ?? {};
    await withTenantContext(prisma, input.tenantId, async (tx) => {
      await tx.verificationMethodAttempt.updateMany({
        where: { caseId: input.caseId, method: input.method },
        data: { resultMeta: resultMeta as Prisma.InputJsonValue },
      });
      await tx.verificationCase.updateMany({
        where: { id: input.caseId, status: 'PENDING' },
        data: { status: 'IN_REVIEW' },
      });
    });
    return { pending: true, resultMeta };
  }

  await persistAttemptResult(input.tenantId, input.caseId, input.method, result);
  return { pending: false, status: result.status, raw: result.raw };
}

export interface CompleteMethodActivityInput {
  caseId: string;
  tenantId: string;
  subjectId: string;
  method: string;
  /** Whatever startMethodActivity persisted as resultMeta — e.g. otp_sms's codeHash. */
  resultMeta: Record<string, unknown>;
  /** The generic signal payload apps/api forwarded from the subject's submission. */
  payload: Record<string, unknown>;
}

export interface CompleteMethodActivityResult {
  status: 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';
  raw: Record<string, unknown>;
}

/** Runs a method's handleCallback() with the subject's submission and persists the result. */
export async function completeMethodActivity(
  input: CompleteMethodActivityInput,
): Promise<CompleteMethodActivityResult> {
  const provider = getProvider(input.method);
  if (!provider.handleCallback) {
    throw new Error(`"${input.method}" provider has no handleCallback but its start() returned pending.`);
  }

  const providerPayload = await resolveProviderPayload(input.payload, input.resultMeta);
  const result = await provider.handleCallback(providerPayload);

  await persistAttemptResult(input.tenantId, input.caseId, input.method, result);
  return { status: result.status, raw: result.raw };
}

export interface ExpireMethodActivityInput {
  caseId: string;
  tenantId: string;
  method: string;
}

/** The subject never completed this method within its timeout. */
export async function expireMethodActivity(input: ExpireMethodActivityInput): Promise<void> {
  await withTenantContext(prisma, input.tenantId, async (tx) => {
    await tx.verificationMethodAttempt.updateMany({
      where: { caseId: input.caseId, method: input.method },
      data: { status: 'FAILED', completedAt: new Date() },
    });
  });
}

/**
 * Translates a generic signal payload into what a provider's handleCallback
 * expects, dispatched by the payload's own shape — a stored-document
 * reference vs. an inline value — never by branching on the method name
 * (docs/HOUSE-RULES.md rule 1). Any future method that needs an uploaded
 * file reuses the storageKey branch; any future method that submits an
 * inline value (like otp_sms's code) reuses the passthrough.
 */
async function resolveProviderPayload(
  payload: Record<string, unknown>,
  resultMeta: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const storageKey = payload['storageKey'];
  if (typeof storageKey === 'string') {
    const imageBytes = await storage.get(storageKey);
    return { imageBytes, contentType: payload['contentType'], mockOutcome: payload['mockOutcome'] };
  }
  // otp_sms-shaped: the submitted code travels in the signal directly; the
  // hash to check it against was persisted by startMethodActivity.
  return { ...payload, expectedCodeHash: resultMeta['codeHash'] };
}

async function persistAttemptResult(
  tenantId: string,
  caseId: string,
  method: string,
  result: VerificationResult,
): Promise<void> {
  await withTenantContext(prisma, tenantId, async (tx) => {
    await tx.verificationMethodAttempt.updateMany({
      where: { caseId, method },
      data: { status: result.status, score: result.score ?? null, completedAt: new Date() },
    });
  });
}

export interface ResolveCaseActivityInput {
  tenantId: string;
  caseId: string;
  subjectId: string;
  caseStatus: 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'NEEDS_REVIEW';
  decision: string;
  raw: Record<string, unknown>;
}

/**
 * Finalizes a case once its method sequence is done — every method PASSED,
 * one FAILED, one came back NEEDS_REVIEW, or one timed out. Same shape for
 * every terminal path (case status + audit log + the tenant's signed
 * webhook), called exactly once per case by the workflow.
 */
export async function resolveCaseActivity(input: ResolveCaseActivityInput): Promise<void> {
  const tenant = await withTenantContext(prisma, input.tenantId, async (tx) => {
    await tx.verificationCase.update({
      where: { id: input.caseId },
      data: { status: input.caseStatus, decision: input.decision, resolvedAt: new Date() },
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
