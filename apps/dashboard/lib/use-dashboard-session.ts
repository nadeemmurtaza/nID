'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, clearStoredApiKey, getStoredApiKey, setStoredApiKey, type Tenant } from './api-client';

type SessionState =
  | { kind: 'checking' }
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; apiKey: string; tenant: Tenant };

/**
 * The dashboard's whole auth story, in one hook: an API key in
 * localStorage, verified against GET /v1/tenants/me on load. See
 * api-client.ts's note on why this is the right boundary for Phase 0.
 */
export function useDashboardSession() {
  const [state, setState] = useState<SessionState>({ kind: 'checking' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const tryKey = useCallback(async (key: string): Promise<boolean> => {
    try {
      const tenant = await apiFetch<Tenant>('/v1/tenants/me', key);
      setState({ kind: 'signed-in', apiKey: key, tenant });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const stored = getStoredApiKey();
    if (!stored) {
      setState({ kind: 'signed-out' });
      return;
    }
    void tryKey(stored).then((ok) => {
      if (!ok) {
        clearStoredApiKey();
        setState({ kind: 'signed-out' });
      }
    });
  }, [tryKey]);

  async function login(key: string): Promise<void> {
    setLoginError(null);
    setLoggingIn(true);
    const ok = await tryKey(key);
    setLoggingIn(false);
    if (ok) {
      setStoredApiKey(key);
    } else {
      setLoginError('That API key was not accepted. Check it and try again.');
    }
  }

  function logout(): void {
    clearStoredApiKey();
    setState({ kind: 'signed-out' });
  }

  return { state, login, logout, loginError, loggingIn };
}
