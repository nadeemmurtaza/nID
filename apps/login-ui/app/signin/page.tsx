'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, setStoredAccountSession, startAccountOtp, verifyAccountOtp } from '../../lib/api';
import { OtpInput } from '../components/otp-input';
import { Logomark } from '../components/logomark';

type Step = 'phone' | 'code';

/**
 * Screen 2 (Sign in) — redesigned to match Communicator's Login page
 * with logo circle header, Fin Orange accent, and sharp 4 px geometry.
 */
export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function sendCode(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await startAccountOtp(phone.trim());
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
      const { sessionToken } = await verifyAccountOtp(phone.trim(), code);
      setStoredAccountSession(sessionToken);
      router.push('/account');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code did not work. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

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

        <h1>Sign in</h1>
        <p className="lead">Access your NEWAX spaces securely.</p>

        {step === 'phone' ? (
          <form onSubmit={sendCode}>
            <label htmlFor="phone" className="field-label">
              Phone
            </label>
            <input
              id="phone"
              type="text"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={submitting || phone.trim().length === 0}>
              {submitting ? 'Sending…' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p className="lead" style={{ marginBottom: 12 }}>
              Enter the code sent to {phone.trim()}.
            </p>
            <OtpInput value={code} onChange={setCode} disabled={submitting} autoFocus />
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={submitting || code.length < 6}>
              {submitting ? 'Verifying…' : 'Continue'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setStep('phone');
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
          New to NEWAX? <Link href="/create">Create an ID</Link>
        </p>
      </div>
    </main>
  );
}
