'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '../../lib/api';

/**
 * What an RP's "Continue with nID" button links to:
 * /authorize?client_id=...&redirect_uri=...&state=...
 *
 * Creates the OAuthLoginRequest server-side, then hands off to
 * /authorize/[pollToken] — the page that's both the same-device login form
 * and, via its own URL, what a QR code scan lands on from another device.
 */
export default function AuthorizeEntryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AuthorizeEntry />
    </Suspense>
  );
}

function Loading() {
  return (
    <main>
      <div className="card">
        <p className="brand">nID</p>
        <h1>Starting sign-in…</h1>
        <div className="status-line">
          <span className="dot" />
          <span>One moment</span>
        </div>
      </div>
    </main>
  );
}

function AuthorizeEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const state = searchParams.get('state') ?? undefined;

    if (!clientId || !redirectUri) {
      setError('This link is missing client_id or redirect_uri.');
      return;
    }

    apiFetch<{ pollToken: string }>('/v1/oauth/login-requests', {
      method: 'POST',
      body: JSON.stringify({ clientId, redirectUri, state }),
    })
      .then(({ pollToken }) => {
        // Marks this tab as the one that originated the request — see
        // [pollToken]/page.tsx's note on why only this tab claims/redirects.
        // sessionStorage is tab-local and survives this same-tab
        // client-side navigation, but a different tab/device (a QR scan)
        // never has it set.
        window.sessionStorage.setItem(`nid_originated_${pollToken}`, '1');
        router.replace(`/authorize/${pollToken}`);
      })
      .catch((e: unknown) => {
        setError(e instanceof ApiError ? e.message : 'Could not start sign-in. Try again.');
      });
  }, [searchParams, router]);

  if (!error) return <Loading />;

  return (
    <main>
      <div className="card">
        <p className="brand">nID</p>
        <div className="result-icon">⚠️</div>
        <h1>Can&apos;t continue</h1>
        <p className="lead">{error}</p>
      </div>
    </main>
  );
}
