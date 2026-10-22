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
