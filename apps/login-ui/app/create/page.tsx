'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, setStoredAccountSession, startAccountOtp, verifyAccountOtp } from '../../lib/api';
import { OtpInput } from '../components/otp-input';
import { Logomark } from '../components/logomark';

type Step = 'details' | 'code';

/**
 * Screen 3 (Create NEWAX ID) — redesigned to match Communicator's Login page
 * with logo circle header, Fin Orange accent, and sharp 4 px geometry.
 */
export default function CreateAccountPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function startVerification(e: React.FormEvent): Promise<void> {
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

        <h1>Create your NEWAX ID</h1>

        {step === 'details' ? (
          <form onSubmit={startVerification}>
            <label htmlFor="fullName" className="field-label">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={submitting}
              autoFocus
            />

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
            />

            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting || fullName.trim().length === 0 || phone.trim().length === 0}
            >
              {submitting ? 'Sending…' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p className="lead" style={{ marginBottom: 12 }}>
              Verify your phone &mdash; enter the code sent to {phone.trim()}.
            </p>
            <OtpInput value={code} onChange={setCode} disabled={submitting} autoFocus />
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={submitting || code.length < 6}>
              {submitting ? 'Verifying…' : 'Create NEWAX ID'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setStep('details');
                setCode('');
                setError(null);
              }}
              disabled={submitting}
            >
              Back
            </button>
          </form>
        )}

        <p className="lead" style={{ marginTop: 20 }}>
          Already have an ID? <Link href="/signin">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
