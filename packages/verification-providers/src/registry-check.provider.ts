import type { VerificationMethodProvider, VerificationContext, VerificationResult, PendingResult } from './types';
import { isValidMockOutcome, mockScoreFor, type MockOutcome } from './mock-outcome';

export interface RegistryCheckConfig {
  /** e.g. EDUCATION_REGISTRY_API_URL / EMPLOYMENT_REGISTRY_API_URL. */
  apiUrl?: string;
  /** e.g. EDUCATION_REGISTRY_API_KEY / EMPLOYMENT_REGISTRY_API_KEY. */
  apiKey?: string;
}

const VALID_STATUSES: ReadonlySet<string> = new Set<MockOutcome>(['PASSED', 'FAILED', 'NEEDS_REVIEW']);

/**
 * Confirms a claim against an authoritative third-party source — a
 * university registrar (education_registry), an employer/payroll
 * verification service (employment_registry), a bank confirming an
 * account's registered title matches the subject's claimed name
 * (bank_account_title), or a Pakistani e-stamp registry confirming a
 * phone number is the one on file against a claimed CNIC
 * (estamp_registry). Unlike the document-upload providers
 * (ImageClaimProvider), everything this needs is already in the case's
 * input at creation time (whatever reference the tenant supplied — a
 * student ID, an employee ID, a bank account number/IBAN, a CNIC), so
 * start() resolves immediately rather than waiting on a subject upload;
 * handleCallback is never used, exactly like otp_sms's synchronous
 * missing-phone failure path.
 *
 * None of National Student Clearinghouse, Truework/The Work Number, or any
 * provincial e-stamping authority (Pakistani stamp-duty collection —
 * Punjab's runs through Bank of Punjab, Sindh and the other provinces
 * through their own excise & taxation departments — is a devolved,
 * per-province system, so there is no single national vendor to name)
 * offer self-serve signup — each requires an actual institutional or
 * business agreement, which no amount of code produces (same story for any
 * real bank account-verification API). What IS real here: a generic HTTP
 * client against a contract this codebase defines itself —
 *
 *   POST {apiUrl}
 *   Authorization: Bearer {apiKey}
 *   { "method": "education_registry" | "employment_registry" | "bank_account_title" | "estamp_registry",
 *     "referenceId": string, "subjectId": string, "tenantId": string,
 *     "accountTitle"?: string, "phone"?: string }
 *   -> { "status": "PASSED" | "FAILED" | "NEEDS_REVIEW", "score"?: number, "raw"?: object }
 *
 * `accountTitle` only ever accompanies bank_account_title (the tenant's
 * claimed account-holder name for the vendor to compare its own records
 * against). `phone` only ever accompanies estamp_registry (`referenceId`
 * there is the CNIC; `phone` is the number the tenant claims is linked to
 * it, for the vendor to confirm against its own e-stamp purchase/
 * registration records) — education/employment registries already resolve
 * a claimed identity from `referenceId` alone, so both fields are omitted
 * there rather than sent as always-empty. So the moment a real agreement
 * exists with any vendor — whichever province's e-stamping authority or
 * bank operates it for estamp_registry — either point apiUrl straight at
 * it if it already speaks this shape, or put a thin translating adapter in
 * front of it. No code here needs to change either way; only the env vars
 * do.
 */
export class RegistryCheckProvider implements VerificationMethodProvider {
  constructor(
    readonly key: string,
    readonly label: string,
    private readonly devMode: boolean,
    private readonly config: RegistryCheckConfig = {},
  ) {}

  async start(context: VerificationContext): Promise<VerificationResult | PendingResult> {
    if (this.devMode) {
      const rawMockOutcome = context.input['mockOutcome'];
      const status = isValidMockOutcome(rawMockOutcome) ? rawMockOutcome : 'PASSED';
      return {
        status,
        score: mockScoreFor(status),
        raw: {
          mode: 'dev_mock',
          referenceId: context.input['referenceId'] ?? null,
          accountTitle: context.input['accountTitle'] ?? null,
          phone: context.input['phone'] ?? null,
        },
        verified: true,
      };
    }

    return this.callRegistry(context);
  }

  private async callRegistry(context: VerificationContext): Promise<VerificationResult> {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new Error(
        `${this.key}: no registry API configured. Set the matching *_REGISTRY_API_URL and *_REGISTRY_API_KEY ` +
          `env vars for whichever vendor/aggregator you've actually contracted with, or enable this provider's ` +
          `dev-mode env var for local/dev use.`,
      );
    }

    const referenceId = context.input['referenceId'];
    if (typeof referenceId !== 'string' || referenceId.length === 0) {
      return { status: 'FAILED', raw: { reason: 'missing_reference_id' }, verified: false };
    }
    const accountTitle = context.input['accountTitle'];
    if (this.key === 'bank_account_title' && (typeof accountTitle !== 'string' || accountTitle.length === 0)) {
      return { status: 'FAILED', raw: { reason: 'missing_account_title' }, verified: false };
    }
    const phone = context.input['phone'];
    if (this.key === 'estamp_registry' && (typeof phone !== 'string' || phone.length === 0)) {
      return { status: 'FAILED', raw: { reason: 'missing_phone' }, verified: false };
    }

    let response: Response;
    try {
      response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({
          method: this.key,
          referenceId,
          subjectId: context.subjectId,
          tenantId: context.tenantId,
          ...(typeof accountTitle === 'string' && accountTitle.length > 0 ? { accountTitle } : {}),
          ...(typeof phone === 'string' && phone.length > 0 ? { phone } : {}),
        }),
      });
    } catch (err) {
      // Unreachable/network failure is not proof the claim is false —
      // unverified, not a genuine FAILED, same distinction otp_sms draws
      // for a malformed callback.
      return {
        status: 'FAILED',
        raw: { reason: 'registry_unreachable', message: err instanceof Error ? err.message : String(err) },
        verified: false,
      };
    }

    if (!response.ok) {
      return { status: 'FAILED', raw: { reason: 'registry_error_response', httpStatus: response.status }, verified: false };
    }

    const body: unknown = await response.json().catch(() => null);
    const parsed = parseRegistryResponse(body);
    if (!parsed) {
      return { status: 'FAILED', raw: { reason: 'malformed_registry_response' }, verified: false };
    }

    return { status: parsed.status, score: parsed.score, raw: { source: 'registry_api', ...parsed.raw }, verified: true };
  }
}

interface ParsedRegistryResponse {
  status: 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';
  score?: number;
  raw: Record<string, unknown>;
}

function parseRegistryResponse(body: unknown): ParsedRegistryResponse | null {
  if (typeof body !== 'object' || body === null) return null;
  const status = (body as Record<string, unknown>)['status'];
  if (typeof status !== 'string' || !VALID_STATUSES.has(status)) return null;
  const score = (body as Record<string, unknown>)['score'];
  const raw = (body as Record<string, unknown>)['raw'];
  return {
    status: status as ParsedRegistryResponse['status'],
    score: typeof score === 'number' ? score : undefined,
    raw: typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {},
  };
}
