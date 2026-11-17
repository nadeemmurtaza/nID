'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ApiError, loginAccount, profileDashboardUrl, setStoredAccountSession, startAccountOtp, verifyAccountOtp } from '../../lib/api';

/**
 * The one sign-in page for nID's own first-party apps -- previously
 * apps/profile-ui had its own separate phone+OTP-only login page
 * (app/dashboard/login) and this app had its own separate
 * email+password-only one. Now this is the only one: it offers both
 * methods, and any other first-party app redirects here with
 * ?returnTo=<its own absolute URL> instead of maintaining its own login
 * form. On success, if returnTo is present (and points at a known
 * first-party origin -- never an arbitrary one, to avoid turning this
 * into an open redirect), the session token is handed back via
 * ?session_token=... instead of landing in this app's own /dashboard.
 */
const KNOWN_ORIGINS = [
  'http://localhost:3100',
  'http://localhost:3200',
  'http://localhost:3300',
  'http://localhost:3400',
  'http://localhost:3500',
];

function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return KNOWN_ORIGINS.includes(url.origin) ? raw : null;
  } catch {
    return null;
  }
}

function finish(returnTo: string | null, sessionToken: string): void {
  setStoredAccountSession(sessionToken);
  if (returnTo) {
    const target = new URL(returnTo);
    target.searchParams.set('session_token', sessionToken);
    window.location.href = target.toString();
    return;
  }
  // No one else asked to be handed the token back (see safeReturnTo) --
  // the real personal-profile dashboard lives in apps/profile-ui, so a
  // direct sign-in here goes straight there rather than to a page of its
  // own in this app.
  window.location.href = profileDashboardUrl(sessionToken);
}

type Method = 'password' | 'phone';

function SignInForm() {
  const returnTo = safeReturnTo(useSearchParams().get('returnTo'));

  const [method, setMethod] = useState<Method>('password');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [phoneStep, setPhoneStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitPassword(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { sessionToken } = await loginAccount(email.trim(), password);
      finish(returnTo, sessionToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign you in. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function sendCode(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await startAccountOtp(phone.trim());
      setPhoneStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a code. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { sessionToken } = await verifyAccountOtp(phone.trim(), code);
      finish(returnTo, sessionToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code did not work. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function switchMethod(next: Method): void {
    setMethod(next);
    setError(null);
    setPhoneStep('phone');
    setCode('');
  }

  return (
    <main>
      <div className="card">
        <p className="brand">NID</p>
        <h1>Sign in</h1>
        <p className="lead">Access your work and personal profiles.</p>

        <div className="view-tabs" style={{ margin: '0 0 20px' }}>
          <button type="button" className={`view-tab${method === 'password' ? ' active' : ''}`} onClick={() => switchMethod('password')}>
            Password
          </button>
          <button type="button" className={`view-tab${method === 'phone' ? ' active' : ''}`} onClick={() => switchMethod('phone')}>
            Phone code
          </button>
        </div>

        {method === 'password' ? (
          <form onSubmit={submitPassword}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} autoFocus required />

            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} required />

            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : phoneStep === 'phone' ? (
          <form onSubmit={sendCode}>
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
              required
            />

            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting || phone.trim().length === 0}>
              {submitting ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <label htmlFor="code">Enter the code sent to {phone.trim()}</label>
            <input id="code" type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} disabled={submitting} autoFocus required />

            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting || code.length === 0}>
              {submitting ? 'Verifying…' : 'Verify code'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setPhoneStep('phone');
                setCode('');
                setError(null);
              }}
              disabled={submitting}
            >
              Use a different number
            </button>
          </form>
        )}

        <p className="lead" style={{ marginTop: 20 }}>
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
