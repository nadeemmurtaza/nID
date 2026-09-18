const STORAGE_KEY = 'nid_account_session';

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
