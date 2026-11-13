'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, startOtp, verifyOtp } from '../../../lib/owner-api';
import { setStoredAccountSession } from '../../../lib/session';
import { Logomark } from '../../components/logomark';
import { OtpInput } from '../../components/otp-input';

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
        <div className="login-logo">
          <Logomark size={44} />
        </div>
        <p className="brand">nID Profiles</p>
        <h1>Manage your profile</h1>
        <p className="lead">
          {step === 'phone'
            ? 'Sign in with your nID account to edit your page.'
            : `Enter the code sent to ${phone.trim()}.`}
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
            <button
              type="submit"
              className="btn btn-primary btn-block"
              style={{ marginTop: 12 }}
              disabled={submitting || phone.trim().length === 0}
            >
              {submitting ? 'Sending…' : 'Continue with phone'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        ) : (
          <form onSubmit={verify}>
            <OtpInput value={code} onChange={setCode} disabled={submitting} autoFocus />
            <button
              type="submit"
              className="btn btn-primary btn-block"
              style={{ marginTop: 12 }}
              disabled={submitting || code.length === 0}
            >
              {submitting ? 'Verifying…' : 'Verify code'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: 8 }}
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
            >
              Use a different number
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
