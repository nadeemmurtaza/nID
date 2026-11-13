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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
    throw new ApiError(message ?? `Request to ${path} failed with ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
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
  phoneVerifiedAt: string | null;
}

export interface LoginRequestStatus {
  status: 'PENDING' | 'APPROVED' | 'EXPIRED';
  clientName: string;
}

/** Starts (or re-sends) a one-time sign-in/registration code for a phone number. */
export function startAccountOtp(phone: string): Promise<{ accepted: true }> {
  return apiFetch('/v1/accounts/otp/start', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

/**
 * Verifying the first-ever code for a phone number both creates the
 * Account and signs it in -- there is no separate "register" endpoint
 * (see apps/api's AccountsService doc comment).
 */
export function verifyAccountOtp(
  phone: string,
  code: string,
): Promise<{ sessionToken: string; account: Account }> {
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
