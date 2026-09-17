'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_NID_API_URL ?? 'http://localhost:4000';

type CaseStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

interface SessionStatus {
  status: CaseStatus;
  method: string | null;
  phone: string | null;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: SessionStatus };

export default function SessionPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/sessions/${token}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setState({ kind: 'error', message: body?.message ?? 'This verification link could not be loaded.' });
        return;
      }
      const data = (await res.json()) as SessionStatus;
      setState({ kind: 'ready', data });
    } catch {
      setState({ kind: 'error', message: 'Could not reach the verification service. Check your connection.' });
    }
  }, [token]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // While a case is IN_REVIEW after a code is submitted, poll for the
  // Temporal workflow's decision rather than leaving the page stuck on
  // "Verifying…" forever.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    if (state.data.status !== 'IN_REVIEW' || !submitting) return;

    const interval = setInterval(() => void fetchStatus(), 2000);
    return () => clearInterval(interval);
  }, [state, submitting, fetchStatus]);

  useEffect(() => {
    if (state.kind === 'ready' && submitting) {
      if (state.data.status === 'APPROVED' || state.data.status === 'REJECTED' || state.data.status === 'EXPIRED') {
        setSubmitting(false);
      }
    }
  }, [state, submitting]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/v1/sessions/${token}/otp/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
        setSubmitError(message ?? 'Could not submit that code. Try again.');
        setSubmitting(false);
        return;
      }
      await fetchStatus();
    } catch {
      setSubmitError('Could not reach the verification service. Check your connection.');
      setSubmitting(false);
    }
  }

  return (
    <main>
      <div className="card">
        <p className="brand">nID Verification</p>
        {state.kind === 'loading' && <Loading />}
        {state.kind === 'error' && <ErrorView message={state.message} />}
        {state.kind === 'ready' && (
          <ResultView
            data={state.data}
            code={code}
            setCode={setCode}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitError={submitError}
          />
        )}
      </div>
    </main>
  );
}

function Loading() {
  return (
    <>
      <h1>Loading…</h1>
      <div className="status-line">
        <span className="dot pending" />
        <span>Fetching your verification status</span>
      </div>
    </>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <>
      <div className="result-icon">⚠️</div>
      <h1>Can&apos;t continue</h1>
      <p className="lead">{message}</p>
    </>
  );
}

function ResultView({
  data,
  code,
  setCode,
  onSubmit,
  submitting,
  submitError,
}: {
  data: SessionStatus;
  code: string;
  setCode: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  submitError: string | null;
}) {
  if (data.status === 'APPROVED') {
    return (
      <>
        <div className="result-icon">✅</div>
        <h1>You&apos;re verified</h1>
        <p className="lead">Your identity has been confirmed. You can close this page.</p>
      </>
    );
  }

  if (data.status === 'REJECTED') {
    return (
      <>
        <div className="result-icon">❌</div>
        <h1>Verification failed</h1>
        <p className="lead">
          We couldn&apos;t confirm your identity with the code provided. Ask whoever sent you here for a new link.
        </p>
      </>
    );
  }

  if (data.status === 'EXPIRED') {
    return (
      <>
        <div className="result-icon">⏱️</div>
        <h1>This link expired</h1>
        <p className="lead">The code window closed before verification finished. Ask for a new link to try again.</p>
      </>
    );
  }

  if (data.method !== 'otp_sms') {
    return (
      <>
        <h1>Unsupported method</h1>
        <p className="lead">This verification uses a method this page doesn&apos;t support yet ({data.method}).</p>
      </>
    );
  }

  return (
    <>
      <h1>Enter your code</h1>
      <p className="lead">
        {data.phone
          ? `We sent a 6-digit code to ${data.phone}.`
          : 'Enter the 6-digit code you were sent.'}
      </p>
      <form onSubmit={onSubmit}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          disabled={submitting}
          autoFocus
        />
        <button type="submit" disabled={submitting || code.length === 0}>
          {submitting ? 'Verifying…' : 'Submit code'}
        </button>
      </form>
      {submitError && <p className="error-text">{submitError}</p>}
      {submitting && !submitError && (
        <div className="status-line">
          <span className="dot pending" />
          <span>Waiting for a decision…</span>
        </div>
      )}
    </>
  );
}
