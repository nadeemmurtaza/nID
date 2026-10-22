'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import {
  apiFetch,
  ApiError,
  getStoredAccountSession,
  setStoredAccountSession,
  clearStoredAccountSession,
  type Account,
  type LoginRequestStatus,
} from '../../../lib/api';
import { Logomark } from '../../components/logomark';
import { OtpInput } from '../../components/otp-input';

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'pending' }
  | { kind: 'redirecting' }
  | { kind: 'approved-elsewhere' };

/**
 * The one page that serves both delivery mechanisms for the same approval
 * link: opened directly (same device, via the URL /authorize sent it to),
 * or reached by scanning a QR code of this exact URL on another device.
 *
 * Only the tab that *originated* the request — the one /authorize's entry
 * page redirected from, marked via sessionStorage — ever claims the code
 * and redirects. A tab reached fresh (a QR scan on another device) that
 * approves here must NOT also race to claim: it isn't the tab driving the
 * RP's browser session, and if it claimed first the originating tab would
 * never get the code. See oauth.service.ts's note on why approve() and
 * claim() are separate calls for exactly this reason.
 */
export default function AuthorizePage() {
  const params = useParams<{ pollToken: string }>();
  const pollToken = params.pollToken;

  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [clientName, setClientName] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [account, setAccount] = useState<{ token: string; phone: string } | null>(null);
  const [approving, setApproving] = useState(false);
  const [isOriginatingTab, setIsOriginatingTab] = useState(false);
  const claimedRef = useRef(false);

  useEffect(() => {
    setIsOriginatingTab(window.sessionStorage.getItem(`nid_originated_${pollToken}`) === '1');
  }, [pollToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/authorize/${pollToken}`;
    QRCode.toDataURL(url, { margin: 1, width: 320 })
      .then(setQrDataUrl)
      .catch(() => undefined);
  }, [pollToken]);

  useEffect(() => {
    const token = getStoredAccountSession();
    if (!token) return;
    apiFetch<Account>('/v1/accounts/me', { headers: { authorization: `Bearer ${token}` } })
      .then((acc) => setAccount({ token, phone: acc.phone }))
      .catch(() => clearStoredAccountSession());
  }, []);

  const claimAndRedirect = useCallback(async () => {
    if (claimedRef.current) return;
    claimedRef.current = true;
    try {
      const result = await apiFetch<{ redirectUri: string; code: string; state: string | null }>(
        `/v1/oauth/login-requests/${pollToken}/claim`,
        { method: 'POST' },
      );
      setPhase({ kind: 'redirecting' });
      const url = new URL(result.redirectUri);
      url.searchParams.set('code', result.code);
      if (result.state) url.searchParams.set('state', result.state);
      window.location.href = url.toString();
    } catch {
      // Lost the race, or approved-on-another-tab hasn't landed yet —
      // the next poll tick will see APPROVED again and retry.
      claimedRef.current = false;
    }
  }, [pollToken]);

  useEffect(() => {
    let cancelled = false;

    async function tick(): Promise<void> {
      try {
        const status = await apiFetch<LoginRequestStatus>(`/v1/oauth/login-requests/${pollToken}`);
        if (cancelled) return;
        setClientName(status.clientName);

        if (status.status === 'EXPIRED') {
          setPhase({ kind: 'error', message: 'This sign-in link has expired. Go back and try again.' });
          return;
        }
        if (status.status === 'APPROVED') {
          if (isOriginatingTab) {
            void claimAndRedirect();
          } else {
            setPhase((prev) => (prev.kind === 'redirecting' ? prev : { kind: 'approved-elsewhere' }));
          }
          return;
        }
        setPhase((prev) => (prev.kind === 'loading' ? { kind: 'pending' } : prev));
      } catch (e) {
        if (!cancelled) {
          setPhase({
            kind: 'error',
            message: e instanceof ApiError ? e.message : 'This sign-in link could not be loaded.',
          });
        }
      }
    }

    void tick();
    const interval = setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollToken, claimAndRedirect, isOriginatingTab]);

  async function approveWithToken(token: string): Promise<void> {
    setApproving(true);
    try {
      await apiFetch(`/v1/oauth/login-requests/${pollToken}/approve`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      // The polling loop above picks up APPROVED on its next tick and redirects.
    } catch (e) {
      setApproving(false);
      throw e;
    }
  }

  return (
    <main>
      <div className="card">
        <div className="login-logo">
          <Logomark size={44} />
        </div>
        <p className="brand">nID</p>

        {phase.kind === 'loading' && (
          <>
            <h1>Loading…</h1>
            <div className="status-line">
              <span className="dot" />
              <span>Fetching this sign-in link</span>
            </div>
          </>
        )}

        {phase.kind === 'error' && (
          <>
            <div className="result-icon">⚠️</div>
            <h1>Can&apos;t continue</h1>
            <p className="lead">{phase.message}</p>
          </>
        )}

        {phase.kind === 'redirecting' && (
          <>
            <div className="result-icon">✅</div>
            <h1>Signed in</h1>
            <p className="lead">Taking you back to {clientName || 'the app'}…</p>
          </>
        )}

        {phase.kind === 'approved-elsewhere' && (
          <>
            <div className="result-icon">✅</div>
            <h1>You&apos;re approved</h1>
            <p className="lead">Go back to the device where you started signing in to {clientName || 'the app'} — it will continue automatically.</p>
          </>
        )}

        {phase.kind === 'pending' && (
          <>
            <h1>Sign in to {clientName || 'this app'}</h1>
            <p className="lead">With your nID account.</p>

            {account ? (
              <ExistingAccount
                phone={account.phone}
                submitting={approving}
                onContinue={() => void approveWithToken(account.token)}
                onSwitch={() => {
                  clearStoredAccountSession();
                  setAccount(null);
                }}
              />
            ) : (
              <PhoneLoginForm
                onApproved={(token, phone) => {
                  setStoredAccountSession(token);
                  setAccount({ token, phone });
                }}
                approveWithToken={approveWithToken}
              />
            )}

            <div className="divider">or scan to continue on your phone</div>
            <div className="qr-wrap">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR code for this sign-in link" />
              ) : (
                <div style={{ width: 160, height: 160 }} />
              )}
            </div>
            <p className="qr-hint">Scanning opens this same sign-in page on your phone.</p>
          </>
        )}
      </div>
    </main>
  );
}

function ExistingAccount({
  phone,
  submitting,
  onContinue,
  onSwitch,
}: {
  phone: string;
  submitting: boolean;
  onContinue: () => void;
  onSwitch: () => void;
}) {
  return (
    <>
      <div className="account-chip">Signed in as {phone}</div>
      <button type="button" onClick={onContinue} disabled={submitting}>
        {submitting ? 'Continuing…' : `Continue as ${phone}`}
      </button>
      <button type="button" className="secondary" onClick={onSwitch} disabled={submitting}>
        Use a different number
      </button>
    </>
  );
}

function PhoneLoginForm({
  onApproved,
  approveWithToken,
}: {
  onApproved: (token: string, phone: string) => void;
  approveWithToken: (token: string) => Promise<void>;
}) {
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
      await apiFetch('/v1/accounts/otp/start', { method: 'POST', body: JSON.stringify({ phone }) });
      setStep('code');
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
      const { sessionToken } = await apiFetch<{ sessionToken: string }>('/v1/accounts/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      });
      await approveWithToken(sessionToken);
      onApproved(sessionToken, phone);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code did not work. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'phone') {
    return (
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
    );
  }

  return (
    <form onSubmit={verifyCode}>
      <p className="qr-hint">Enter the code sent to {phone.trim()}.</p>
      <OtpInput value={code} onChange={setCode} disabled={submitting} autoFocus />
      <button type="submit" disabled={submitting || code.length === 0}>
        {submitting ? 'Verifying…' : 'Verify code'}
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
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
