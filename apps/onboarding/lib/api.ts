const API_URL = process.env.NEXT_PUBLIC_NID_API_URL ?? 'http://localhost:4000';
const STORAGE_KEY = 'nid_account_session';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
    throw new ApiError(message ?? `Request to ${path} failed with ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** The real, full personal-profile dashboard lives in apps/profile-ui, not
 * here -- this hands the session token to its login route (which stores it
 * in that app's own per-origin storage and continues into /dashboard), the
 * same first-party handoff apps/profile-ui's own login page uses to come
 * here. */
export function profileDashboardUrl(sessionToken: string): string {
  return `http://localhost:3400/dashboard/login?session_token=${encodeURIComponent(sessionToken)}`;
}

export function getStoredAccountSession(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredAccountSession(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearStoredAccountSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export interface Account {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
}

/** POST /v1/accounts/register — the detailed sign-up form. */
export function registerAccount(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<Account> {
  return apiFetch('/v1/accounts/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** POST /v1/accounts/login — email + password sign-in. */
export function loginAccount(email: string, password: string): Promise<{ sessionToken: string; account: Account }> {
  return apiFetch('/v1/accounts/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/** Starts (or re-sends) a one-time sign-in/registration code for a phone number. */
export function startAccountOtp(phone: string): Promise<{ accepted: true }> {
  return apiFetch('/v1/accounts/otp/start', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

/** Verifying the first-ever code for a phone number both creates the Account and signs it in. */
export function verifyAccountOtp(phone: string, code: string): Promise<{ sessionToken: string; account: Account }> {
  return apiFetch('/v1/accounts/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
}

export function getCurrentAccount(sessionToken: string): Promise<Account> {
  return apiFetch('/v1/accounts/me', {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
}

/** POST /v1/accounts/me/logout — revokes only this one session. */
export function logout(sessionToken: string): Promise<void> {
  return apiFetch('/v1/accounts/me/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${sessionToken}` },
  });
}

/** DELETE /v1/accounts/me — erases the account and its own data. */
export function deleteAccount(sessionToken: string): Promise<void> {
  return apiFetch('/v1/accounts/me', {
    method: 'DELETE',
    headers: { authorization: `Bearer ${sessionToken}` },
  });
}

/** POST /v1/accounts/me/email/start */
export function startEmailVerification(sessionToken: string, email: string): Promise<{ accepted: true }> {
  return apiFetch('/v1/accounts/me/email/start', {
    method: 'POST',
    headers: { authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ email }),
  });
}

/** POST /v1/accounts/me/email/verify */
export function verifyEmail(sessionToken: string, code: string): Promise<Account> {
  return apiFetch('/v1/accounts/me/email/verify', {
    method: 'POST',
    headers: { authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ code }),
  });
}

export interface PersonalProfile {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  isPublished: boolean;
}

/** POST /v1/profiles — creates the account's own personal profile. Requires
 * a verified real-name identity (see ProfilesService::create's
 * require_verified_real_name) — an account without that fails here with
 * the API's own message, which the caller should show verbatim rather
 * than predicting it client-side. */
export function createPersonalProfile(
  sessionToken: string,
  input: { slug: string; displayName: string; category?: string },
): Promise<PersonalProfile> {
  return apiFetch('/v1/profiles', {
    method: 'POST',
    headers: { authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify(input),
  });
}

export interface Organization {
  id: string;
  legalName: string;
  countryCode: string | null;
}

export interface OrgProfile {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  isPublished: boolean;
}

/** GET /v1/organizations/my-memberships — the organizations ("work") this account belongs to. */
export function getMyOrganizations(sessionToken: string): Promise<Organization[]> {
  return apiFetch('/v1/organizations/my-memberships', {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
}

/** GET /v1/organizations/:id/profile — that organization's public ("work") profile, if set up yet. */
export async function getOrganizationProfile(sessionToken: string, organizationId: string): Promise<OrgProfile | null> {
  try {
    return await apiFetch<OrgProfile>(`/v1/organizations/${organizationId}/profile`, {
      headers: { authorization: `Bearer ${sessionToken}` },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** POST /v1/organizations/:id/profile — creates that organization's public
 * profile. Requires the account to be an ACTIVE admin member of a verified
 * (KYB-approved) organization (see OrganizationProfilesService's
 * require_active_admin) — shows the API's own error verbatim if not. */
export function createOrganizationProfile(
  sessionToken: string,
  organizationId: string,
  input: { slug: string; displayName: string; category?: string },
): Promise<OrgProfile> {
  return apiFetch(`/v1/organizations/${organizationId}/profile`, {
    method: 'POST',
    headers: { authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify(input),
  });
}

export interface MembershipInvite {
  id: string;
  organizationId: string;
  role: string;
  status: string;
  createdAt: string;
}

/** GET /v1/organizations/invites/mine — this account's pending invitations. */
export function getMyInvites(sessionToken: string): Promise<MembershipInvite[]> {
  return apiFetch('/v1/organizations/invites/mine', {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
}

/** POST /v1/organizations/invites/:membershipId/accept */
export function acceptInvite(sessionToken: string, membershipId: string): Promise<MembershipInvite> {
  return apiFetch(`/v1/organizations/invites/${membershipId}/accept`, {
    method: 'POST',
    headers: { authorization: `Bearer ${sessionToken}` },
  });
}

/** POST /v1/organizations/invites/:membershipId/decline */
export function declineInvite(sessionToken: string, membershipId: string): Promise<MembershipInvite> {
  return apiFetch(`/v1/organizations/invites/${membershipId}/decline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${sessionToken}` },
  });
}
