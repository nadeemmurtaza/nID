'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  clearStoredAccountSession,
  getCurrentAccount,
  getStoredAccountSession,
  type Account,
} from '../../lib/api';
import { Logomark } from '../components/logomark';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; account: Account };

/**
 * Screen 8 (Profile, security and sessions) from the design brief.
 *
 * What's real: identity (phone, verified status) and signing out the
 * current session, both backed by apps/api's AccountsService.
 *
 * Open questions, recorded rather than invented: the brief's wireframe
 * also shows passkey management, password change, and a list of *other*
 * active sessions with revocation. None of that exists on the backend
 * yet -- there's no WebAuthn credential table, no password at all (see
 * /signin and /create's notes), and AccountSession has no "list my other
 * sessions" or "revoke one" endpoint, only create/resolve. Those sections
 * below are shown as real components in a disabled/not-yet-available
 * state rather than faked.
 */
export default function AccountPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    const token = getStoredAccountSession();
    if (!token) {
      setState({ kind: 'signed-out' });
      return;
    }
    getCurrentAccount(token)
      .then((account) => setState({ kind: 'ready', account }))
      .catch((err: unknown) => {
        clearStoredAccountSession();
        setState({
          kind: 'error',
          message: err instanceof ApiError ? err.message : 'Could not load your account.',
        });
      });
  }, []);

  function signOut(): void {
    clearStoredAccountSession();
    router.push('/signin');
  }

  if (state.kind === 'loading') {
    return (
      <main>
        <div className="card">
          <p className="lead">Loading your account…</p>
        </div>
      </main>
    );
  }

  if (state.kind === 'signed-out' || state.kind === 'error') {
    return (
      <main>
        <div className="card">
          {/* Logo & Brand */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Logomark size={24} />
            </div>
            <p className="brand" style={{ margin: 0 }}>
              NEWAX
            </p>
          </div>
          <h1>Sign in to view your account</h1>
          {state.kind === 'error' && (
            <p className="error-text" role="alert">
              {state.message}
            </p>
          )}
          <a href="/signin" className="btn-link">
            Sign in
          </a>
        </div>
      </main>
    );
  }

  const { account } = state;

  return (
    <main>
      <div className="card" style={{ textAlign: 'left', maxWidth: 480 }}>
        {/* Logo & Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Logomark size={24} />
          </div>
          <p className="brand" style={{ margin: 0 }}>
            Account &amp; security
          </p>
        </div>

        <section className="account-section">
          <h2 className="account-section-title">Identity</h2>
          <div className="account-row">
            <span>{account.phone}</span>
            <span className={`badge ${account.phoneVerifiedAt ? 'verified' : 'unverified'}`}>
              {account.phoneVerifiedAt ? 'Verified' : 'Unverified'}
            </span>
          </div>
        </section>

        <section className="account-section">
          <h2 className="account-section-title">Sign-in methods</h2>
          <div className="account-row">
            <span>Passkeys</span>
            <button type="button" className="secondary" disabled title="Not yet available">
              Manage
            </button>
          </div>
          <div className="account-row">
            <span>Password</span>
            <button type="button" className="secondary" disabled title="Not yet available">
              Set up
            </button>
          </div>
        </section>

        <section className="account-section">
          <h2 className="account-section-title">Active sessions</h2>
          <div className="account-row">
            <span>This device</span>
            <span className="badge verified">Current</span>
          </div>
          <p className="lead" style={{ fontSize: 12, marginTop: 4 }}>
            Viewing and revoking other sessions isn&apos;t available yet.
          </p>
        </section>

        <button type="button" onClick={signOut} style={{ marginTop: 8 }}>
          Sign out
        </button>
      </div>
    </main>
  );
}
