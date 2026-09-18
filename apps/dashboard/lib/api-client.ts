const STORAGE_KEY = 'nid_dashboard_credential';
const API_URL = process.env.NEXT_PUBLIC_NID_API_URL ?? 'http://localhost:4000';

/**
 * A "credential" here is a Bearer token that's either a tenant API key or a
 * real staff member's Account session token (from phone+OTP login) —
 * TenantActorGuard on the apps/api side accepts either, so this layer
 * never needs to know or care which kind it's holding. Storing it in
 * localStorage is the same choice apps/verify-ui and apps/profile-ui's
 * owner dashboard already make for their own session tokens — unlike a
 * subject-facing surface, this app's user already holds real staff-level
 * access, so there's nothing a browser-stored token exposes that the
 * signed-in person couldn't already do.
 */
export function getStoredCredential(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredCredential(credential: string): void {
  window.localStorage.setItem(STORAGE_KEY, credential);
}

export function clearStoredCredential(): void {
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

export async function apiFetch<T>(path: string, credential: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${credential}`,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
    throw new ApiError(message ?? `Request to ${path} failed with ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}

// ---- staff phone+OTP login (unauthenticated — no credential yet) ----

export interface StaffAccount {
  id: string;
  phone: string;
}

export async function startStaffOtp(phone: string): Promise<void> {
  const res = await fetch(`${API_URL}/v1/accounts/otp/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
    throw new ApiError(message ?? 'Could not send a code.', res.status);
  }
}

export async function verifyStaffOtp(phone: string, code: string): Promise<{ sessionToken: string; account: StaffAccount }> {
  const res = await fetch(`${API_URL}/v1/accounts/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
    throw new ApiError(message ?? 'That code did not work.', res.status);
  }
  return res.json() as Promise<{ sessionToken: string; account: StaffAccount }>;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  dataResidencyRegion: string;
  createdAt: string;
  /** Which kind of credential this session actually authenticated with — see TenantActorGuard. */
  signedInAs: 'API_KEY' | 'TENANT_STAFF';
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
  credential: string,
  caseId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string,
): Promise<VerificationCaseDetail> {
  return apiFetch<VerificationCaseDetail>(`/v1/verification-cases/${caseId}/resolve`, credential, {
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
