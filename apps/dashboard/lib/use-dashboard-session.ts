'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  apiFetch,
  clearStoredCredential,
  getStoredCredential,
  setStoredCredential,
  type Tenant,
} from './api-client';

type SessionState =
  | { kind: 'checking' }
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; credential: string; tenant: Tenant };

/**
 * The dashboard's whole auth story, in one hook: a credential (a tenant API
 * key or a real staff Account session token — see api-client.ts's own
 * comment) in localStorage, verified against GET /v1/tenants/me on load.
 * Phone+OTP login itself lives in LoginScreen (app/page.tsx) — this hook
 * only cares about the resulting credential, exactly the same shape
 * either kind of login produces.
 */
export function useDashboardSession() {
  const [state, setState] = useState<SessionState>({ kind: 'checking' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const tryCredential = useCallback(async (credential: string): Promise<boolean> => {
    try {
      const tenant = await apiFetch<Tenant>('/v1/tenants/me', credential);
      setState({ kind: 'signed-in', credential, tenant });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const stored = getStoredCredential();
    if (!stored) {
      setState({ kind: 'signed-out' });
      return;
    }
    void tryCredential(stored).then((ok) => {
      if (!ok) {
        clearStoredCredential();
        setState({ kind: 'signed-out' });
      }
    });
  }, [tryCredential]);

  async function login(credential: string): Promise<void> {
    setLoginError(null);
    setLoggingIn(true);
    const ok = await tryCredential(credential);
    setLoggingIn(false);
    if (ok) {
      setStoredCredential(credential);
    } else {
      setLoginError('Signed in, but this account is not staff on any nID tenant yet — ask an admin to invite you.');
    }
  }

  function logout(): void {
    clearStoredCredential();
    setState({ kind: 'signed-out' });
  }

  return { state, login, logout, loginError, loggingIn };
}
