'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@newax/design-tokens/ConfirmDialog';
import { ApiError, clearStoredAccountSession, deleteAccount, startEmailVerification, verifyEmail } from '../../../lib/api';
import { useDashboard } from '../../../lib/dashboard-context';

/** Lives directly under app/dashboard, not under personal or work -- it's
 * reachable from the top bar regardless of which of those two contexts is
 * active (see components/TopBar.tsx), so it renders without either
 * context's own sidebar. */
export default function AccountPage() {
  const router = useRouter();
  const { token, account, setAccount } = useDashboard();
  const { confirm, dialog } = useConfirm();

  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function sendCode(): Promise<void> {
    if (!account.email) return;
    setVerifyError(null);
    setSendingCode(true);
    try {
      await startEmailVerification(token, account.email);
      setCodeSent(true);
    } catch (err) {
      setVerifyError(err instanceof ApiError ? err.message : 'Could not send a verification code.');
    } finally {
      setSendingCode(false);
    }
  }

  async function confirmCode(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setVerifyError(null);
    setVerifying(true);
    try {
      const updated = await verifyEmail(token, code);
      setAccount(updated);
      setCodeSent(false);
      setCode('');
    } catch (err) {
      setVerifyError(err instanceof ApiError ? err.message : 'That code did not work.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleDelete(): Promise<void> {
    const ok = await confirm({
      title: 'Delete your account?',
      body:
        'Your profile, sign-in sessions, access grants and roles are erased. Organizations that hold records about you keep them, but they stop being linked to you. This cannot be undone.',
      confirmLabel: 'Delete my account',
    });
    if (!ok) return;
    setDeleteError(null);
    try {
      await deleteAccount(token);
      clearStoredAccountSession();
      router.push('/signup');
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete your account. Try again.');
    }
  }

  return (
    <div className="dashboard-content">
      <div className="tab-panel">
        <section>
          <h1>Account</h1>

          <div className="account-section">
            <p className="account-section-title">Identity</p>
            <div className="account-chip">
              <span className="account-chip-label">Name</span>
              <span className="account-chip-value">{account.name ?? '—'}</span>
            </div>
            <div className="account-chip">
              <span className="account-chip-label">Phone</span>
              <span className="account-chip-value">{account.phone}</span>
              <span className={`badge ${account.phoneVerifiedAt ? 'verified' : 'unverified'}`} style={{ marginTop: 6, width: 'fit-content' }}>
                {account.phoneVerifiedAt ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <div className="account-chip">
              <span className="account-chip-label">Email</span>
              <span className="account-chip-value">{account.email ?? '—'}</span>
              <span className={`badge ${account.emailVerifiedAt ? 'verified' : 'unverified'}`} style={{ marginTop: 6, width: 'fit-content' }}>
                {account.emailVerifiedAt ? 'Verified' : 'Unverified'}
              </span>
            </div>

            {!account.emailVerifiedAt && account.email && (
              <div style={{ marginTop: 12 }}>
                {!codeSent ? (
                  <button type="button" style={{ width: 'auto' }} onClick={sendCode} disabled={sendingCode}>
                    {sendingCode ? 'Sending…' : 'Verify email'}
                  </button>
                ) : (
                  <form onSubmit={confirmCode}>
                    <label htmlFor="verify-code">Enter the code sent to {account.email}</label>
                    <input id="verify-code" type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} disabled={verifying} autoFocus />
                    <button type="submit" disabled={verifying || code.length === 0}>
                      {verifying ? 'Verifying…' : 'Confirm'}
                    </button>
                  </form>
                )}
                {verifyError && (
                  <p className="error-text" role="alert">
                    {verifyError}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="account-section">
            <p className="account-section-title">Delete account</p>
            <p className="lead" style={{ fontSize: 13 }}>
              Erase your account and the data that belongs to it. Organizations that hold records about you keep them,
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
          </div>
          {dialog}
        </section>
      </div>
    </div>
  );
}
