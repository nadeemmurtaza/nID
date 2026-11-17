'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setStoredAccountSession } from '../../../lib/session';

/**
 * This app no longer has its own login form -- apps/onboarding's
 * /signin (http://localhost:3500/signin) is now the one sign-in page for
 * every nID first-party app, offering both phone+OTP and email+password.
 * This route only ever does one of two things:
 *
 *   1. No `session_token` query param yet: it's the *entry* point (linked
 *      from app/dashboard/layout.tsx when there's no session) -- redirect
 *      out to the unified sign-in with `returnTo` set to this exact URL,
 *      so it comes right back here afterward.
 *   2. `session_token` present: it's the *return* leg of that round trip
 *      -- store the token in this app's own localStorage (each app's
 *      storage is per-origin, so it can't be shared directly) and
 *      continue into /dashboard.
 */
function LoginRedirect() {
  const router = useRouter();
  const token = useSearchParams().get('session_token');

  useEffect(() => {
    if (token) {
      setStoredAccountSession(token);
      router.replace('/dashboard');
      return;
    }
    const returnTo = `${window.location.origin}/dashboard/login`;
    window.location.href = `http://localhost:3500/signin?returnTo=${encodeURIComponent(returnTo)}`;
  }, [router, token]);

  return (
    <main className="center-page">
      <div className="card">
        <p className="lead">Redirecting to sign in…</p>
      </div>
    </main>
  );
}

export default function DashboardLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginRedirect />
    </Suspense>
  );
}
