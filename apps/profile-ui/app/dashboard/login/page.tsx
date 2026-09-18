'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, startOtp, verifyOtp } from '../../../lib/owner-api';
import { setStoredAccountSession } from '../../../lib/session';

/** Same phone+OTP UX as apps/login-ui's PhoneLoginForm, minus the OAuth-approve step this app has no use for. */
export default function DashboardLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function sendCode(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await startOtp(phone);
      setStep('code');
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
      setStoredAccountSession(sessionToken);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code did not work. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="center-page">
      <div className="card">
        <p
          style={{
            marginBottom: 18,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
          }}
        >
          nID Profiles
        </p>
        <h1>Manage your profile</h1>
        <p className="lead" style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
          Sign in with your nID account to edit your page.
        </p>

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
            <button type="submit" disabled={submitting || phone.trim().length === 0}>
              {submitting ? 'Sending…' : 'Continue with phone'}
            </button>
            {error && <p className="error-text">{error}</p>}
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
            <button type="submit" disabled={submitting || code.length === 0}>
              {submitting ? 'Verifying…' : 'Verify code'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
