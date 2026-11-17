'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@newax/design-tokens/ConfirmDialog';
import { ApiError, deleteAccount, getMe, startEmailVerification, verifyEmail, type Account } from '../../../lib/owner-api';
import { clearStoredAccountSession } from '../../../lib/session';
import { useDashboard } from '../../../lib/dashboard-context';

export default function AccountPage() {
  const router = useRouter();
  const { token } = useDashboard();
  const { confirm, dialog } = useConfirm();

  const [account, setAccount] = useState<Account | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    getMe(token)
      .then(setAccount)
      .catch(() => setLoadError('Could not load your account.'));
  }, [token]);

  async function sendCode(): Promise<void> {
    if (!account?.email) return;
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
      body: 'Your profile, sign-in sessions, access grants and roles are erased. Organizations that hold records about you keep them, but they stop being linked to you. This cannot be undone.',
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

  if (loadError) return <p className="error-text">{loadError}</p>;
  if (!account) return <p className="lead">Loading…</p>;

  return (
    <div className="tab-content">
      <h1>Account</h1>

      <section className="panel-card">
        <h2>Identity</h2>
        <p>{account.name ?? '—'}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span>{account.phone}</span>
          <span className={`verify-tag ${account.phoneVerifiedAt ? 'verified' : 'unverified'}`}>{account.phoneVerifiedAt ? 'Verified' : 'Unverified'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span>{account.email ?? '—'}</span>
          <span className={`verify-tag ${account.emailVerifiedAt ? 'verified' : 'unverified'}`}>{account.emailVerifiedAt ? 'Verified' : 'Unverified'}</span>
        </div>

        {!account.emailVerifiedAt && account.email && (
          <div style={{ marginTop: 12 }}>
            {!codeSent ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={sendCode} disabled={sendingCode}>
                {sendingCode ? 'Sending…' : 'Verify email'}
              </button>
            ) : (
              <form onSubmit={confirmCode}>
                <p className="lead">Enter the code sent to {account.email}</p>
                <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} disabled={verifying} autoFocus />
                <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={verifying || code.length === 0}>
                  {verifying ? 'Verifying…' : 'Confirm'}
                </button>
              </form>
            )}
            {verifyError && <p className="error-text">{verifyError}</p>}
          </div>
        )}
      </section>

      <section className="panel-card" style={{ marginTop: 16 }}>
        <h2>Delete account</h2>
        <p className="lead">Erase your account and the data that belongs to it. Organizations that hold records about you keep them, unlinked from you.</p>
        {deleteError && <p className="error-text">{deleteError}</p>}
        <button type="button" className="btn btn-secondary" onClick={handleDelete}>
          Delete my account
        </button>
      </section>
      {dialog}
    </div>
  );
}
