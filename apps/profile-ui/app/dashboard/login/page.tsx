'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, loginAccount, startOtp, verifyOtp } from '../../../lib/owner-api';
import { setStoredAccountSession } from '../../../lib/session';
import { Logomark } from '../../components/logomark';
import { OtpInput } from '../../components/otp-input';

type Method = 'password' | 'phone';

/** The one sign-in page for this account system -- offers both methods
 * (password, from the detailed sign-up form; phone+OTP, the original
 * passwordless flow) instead of needing a separate app/port for either. */
export default function DashboardLoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('password');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [phoneStep, setPhoneStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function finish(sessionToken: string): void {
    setStoredAccountSession(sessionToken);
    router.replace('/dashboard');
  }

  async function submitPassword(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { sessionToken } = await loginAccount(email.trim(), password);
      finish(sessionToken);
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
      await startOtp(phone);
      setPhoneStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a code. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { sessionToken } = await verifyOtp(phone, code);
      finish(sessionToken);
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
    <main className="center-page">
      <div className="card">
        <div className="login-logo">
          <Logomark size={44} />
        </div>
        <p className="brand">nID Profiles</p>
        <h1>Sign in</h1>
        <p className="lead">Manage your personal and work profiles.</p>

        <div className="subnav" style={{ marginBottom: 16 }}>
          <button type="button" className={`subnav-btn${method === 'password' ? ' active' : ''}`} onClick={() => switchMethod('password')}>
            Password
          </button>
          <button type="button" className={`subnav-btn${method === 'phone' ? ' active' : ''}`} onClick={() => switchMethod('phone')}>
            Phone code
          </button>
        </div>

        {method === 'password' ? (
          <form onSubmit={submitPassword}>
            <input type="text" inputMode="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} autoFocus />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} style={{ marginTop: 8 }} />
            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={submitting || !email.trim() || !password}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        ) : phoneStep === 'phone' ? (
          <form onSubmit={sendCode}>
            <input
              type="text"
              inputMode="tel"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
            />
            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={submitting || phone.trim().length === 0}>
              {submitting ? 'Sending…' : 'Continue with phone'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        ) : (
          <form onSubmit={verify}>
            <p className="lead" style={{ marginBottom: 12 }}>Enter the code sent to {phone.trim()}.</p>
            <OtpInput value={code} onChange={setCode} disabled={submitting} autoFocus />
            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={submitting || code.length === 0}>
              {submitting ? 'Verifying…' : 'Verify code'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: 8 }}
              onClick={() => {
                setPhoneStep('phone');
                setCode('');
                setError(null);
              }}
            >
              Use a different number
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        )}

        <p className="lead" style={{ marginTop: 20 }}>
          New here? <a href="/signup">Create an account</a>
        </p>
      </div>
    </main>
  );
}
