'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  apiFetch,
  startStaffOtp,
  verifyStaffOtp,
  ApiError,
  type VerificationCaseListItem,
} from '../lib/api-client';
import { useDashboardSession } from '../lib/use-dashboard-session';
import { Header } from './components/header';
import { subjectName } from './format';

export default function DashboardHome() {
  const { state, login, logout, loginError, loggingIn } = useDashboardSession();

  if (state.kind === 'checking') {
    return (
      <div className="login-wrap">
        <p className="lead">Checking for a saved session…</p>
      </div>
    );
  }

  if (state.kind === 'signed-out') {
    return <LoginScreen onLogin={login} error={loginError} loading={loggingIn} />;
  }

  return (
    <>
      <Header tenant={state.tenant} onLogout={logout} />
      <main className="shell">
        <CaseList credential={state.credential} />
      </main>
    </>
  );
}

/**
 * Real staff login: phone + OTP against nID's own Account system (the
 * same primitive apps/login-ui and apps/profile-ui already use — see
 * accounts.service.ts), not a shared secret pasted into a text field.
 * `onLogin` hands the resulting real session token to
 * useDashboardSession, which verifies it against GET /v1/tenants/me
 * (TenantStaffMembership decides whether it's accepted).
 */
function LoginScreen({
  onLogin,
  error,
  loading,
}: {
  onLogin: (credential: string) => void;
  error: string | null;
  loading: boolean;
}) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function sendCode(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setStepError(null);
    setSubmitting(true);
    try {
      await startStaffOtp(phone.trim());
      setStep('code');
    } catch (err) {
      setStepError(err instanceof ApiError ? err.message : 'Could not send a code. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setStepError(null);
    setSubmitting(true);
    try {
      const { sessionToken } = await verifyStaffOtp(phone.trim(), code);
      onLogin(sessionToken);
    } catch (err) {
      setStepError(err instanceof ApiError ? err.message : 'That code did not work. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <p className="brand">nID Dashboard</p>
        <h1>Sign in as staff</h1>
        <p className="lead">Sign in with your nID account. An admin invites your phone number as staff first.</p>

        {step === 'phone' ? (
          <form onSubmit={sendCode}>
            <input
              type="text"
              inputMode="tel"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            {stepError && <p className="error-text">{stepError}</p>}
            <button className="primary-block" type="submit" disabled={submitting || phone.trim().length === 0}>
              {submitting ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={submitting}
              autoFocus
            />
            {stepError && <p className="error-text">{stepError}</p>}
            {error && <p className="error-text">{error}</p>}
            <button
              className="primary-block"
              type="submit"
              disabled={submitting || loading || code.length === 0}
            >
              {submitting || loading ? 'Verifying…' : 'Verify code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function CaseList({ credential }: { credential: string }) {
  const [cases, setCases] = useState<VerificationCaseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<VerificationCaseListItem[]>('/v1/verification-cases', credential)
      .then(setCases)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load cases.'));
  }, [credential]);

  if (error) return <p className="error-text">{error}</p>;
  if (!cases) return <p className="lead">Loading cases…</p>;
  if (cases.length === 0) {
    return (
      <div className="empty-state">
        No verification cases yet. Create one with <code>POST /v1/verification-cases</code>.
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>Claim</th>
          <th>Status</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => (
          <tr key={c.id}>
            <td>
              <Link href={`/cases/${c.id}`}>{subjectName(c.subject)}</Link>
            </td>
            <td>{c.claimType}</td>
            <td>
              <span className={`badge ${c.status}`}>{c.status}</span>
            </td>
            <td>{new Date(c.createdAt).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
