const STORAGE_KEY = 'nid_dashboard_api_key';
const API_URL = process.env.NEXT_PUBLIC_NID_API_URL ?? 'http://localhost:4000';

/**
 * Phase 0 has no staff-login system (no TenantStaffUser, no password, no
 * session cookie) — only the tenant API key issued by `pnpm db:seed` (or a
 * future dashboard-side key-management screen). Storing it in localStorage
 * and sending it as the dashboard's own auth is a deliberate Phase 0
 * simplification: the dashboard's "user" is the tenant's own staff, who
 * already hold this credential — unlike apps/verify-ui, which must never
 * hold it (a subject there is untrusted). See docs/PHASES.md.
 */
export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredApiKey(key: string): void {
  window.localStorage.setItem(STORAGE_KEY, key);
}

export function clearStoredApiKey(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, apiKey: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
    throw new ApiError(message ?? `Request to ${path} failed with ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  dataResidencyRegion: string;
  createdAt: string;
}

export interface Subject {
  id: string;
  type: 'PERSON' | 'ORGANIZATION';
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  phone: string | null;
}

export type CaseStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'NEEDS_REVIEW';
export type ClaimType = 'IDENTITY' | 'DATE_OF_BIRTH' | 'EDUCATION' | 'EMPLOYMENT';
export type VerificationLevel = 'SELF_ATTESTED' | 'DOCUMENT_VERIFIED' | 'REGISTRY_VERIFIED';

export interface VerificationCaseListItem {
  id: string;
  status: CaseStatus;
  claimType: ClaimType;
  level: VerificationLevel;
  createdAt: string;
  resolvedAt: string | null;
  subject: Subject;
}

export interface VerificationMethodAttempt {
  id: string;
  method: string;
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';
  providerKey: string;
  startedAt: string;
  completedAt: string | null;
}

export interface VerificationCaseDetail extends VerificationCaseListItem {
  policyId: string;
  temporalWorkflowId: string | null;
  decision: string | null;
  reviewerId: string | null;
  attempts: VerificationMethodAttempt[];
}

/** The manual-review queue's one action — see apps/api's resolveCase(). */
export function resolveCase(
  apiKey: string,
  caseId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string,
): Promise<VerificationCaseDetail> {
  return apiFetch<VerificationCaseDetail>(`/v1/verification-cases/${caseId}/resolve`, apiKey, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision, reason }),
  });
}

/** One entry per ClaimType a Subject has ever passed a case for — see apps/api's badges endpoint. */
export interface SubjectBadge {
  claimType: ClaimType;
  level: VerificationLevel;
  verifiedAt: string | null;
  caseId: string | null;
}

export interface SubjectBadges {
  subjectId: string;
  badges: SubjectBadge[];
}
