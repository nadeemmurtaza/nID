'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '../../../../lib/api';
import { getVerificationStatus, startEmailVerification, verifyEmail } from '../../../../lib/owner-api';
import { OtpInput } from '../../../components/otp-input';

interface Props {
  token: string;
}

export function EmailVerification({ token }: Props) {
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVerificationStatus(token).then((status) => {
      if (status.email.verifiedAt && status.email.address) {
        setVerifiedEmail(status.email.address);
        setStep('done');
      }
    });
  }, [token]);

  async function sendCode(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await startEmailVerification(token, email);
      setStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a code. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmCode(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const account = await verifyEmail(token, code);
      setVerifiedEmail(account.email);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code did not work. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Email verification
      </h2>

      {step === 'done' && verifiedEmail && (
        <div className="section-card">
          <div className="data-row">
            <span>{verifiedEmail}</span>
            <span className="verify-tag verified">✓ Verified</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setStep('email')}>
            Verify a different email
          </button>
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={sendCode} className="section-card">
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send verification code'}
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={confirmCode} className="section-card">
          <p className="meta" style={{ marginBottom: 12 }}>
            Enter the code sent to {email}.
          </p>
          <OtpInput value={code} onChange={setCode} disabled={submitting} autoFocus />
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={submitting || code.length !== 6}>
            {submitting ? 'Verifying…' : 'Verify email'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setStep('email')}>
            Use a different email
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>
      )}
    </div>
  );
}
