'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  clearStoredAccountSession,
  deleteAccount,
  getCurrentAccount,
  getStoredAccountSession,
  type Account,
} from '../../lib/api';
import { Logomark } from '../components/logomark';
import { useConfirm } from '@newax/design-tokens/ConfirmDialog';
import { Skeleton } from '@newax/design-tokens/Skeleton';

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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

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

  async function handleDelete(): Promise<void> {
    const token = getStoredAccountSession();
    if (!token) return;
    const ok = await confirm({
      title: 'Delete your account?',
      body:
        'Your profile, sign-in sessions, access grants and roles are erased. Organisations that hold records about you keep them, but they stop being linked to you. This cannot be undone.',
      confirmLabel: 'Delete my account',
    });
    if (!ok) return;
    setDeleteError(null);
    try {
      await deleteAccount(token);
      clearStoredAccountSession();
      router.push('/');
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete your account. Try again.');
    }
  }

  if (state.kind === 'loading') {
    return (
      <main>
        <div className="card" aria-busy="true" aria-label="Loading your account">
          <Skeleton height={48} width={48} />
          <Skeleton count={3} />
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

        <section className="account-section">
          <h2 className="account-section-title">Delete account</h2>
          <p className="lead" style={{ fontSize: 13 }}>
            Erase your account and the data that belongs to it. Organisations that hold records about you keep them,
            unlinked from you.
          </p>
          {deleteError && (
            <p className="error-text" role="alert">
              {deleteError}
            </p>
          )}
          <button type="button" className="secondary" onClick={handleDelete}>
            Delete my account
          </button>
        </section>
        {dialog}
      </div>
    </main>
  );
}
