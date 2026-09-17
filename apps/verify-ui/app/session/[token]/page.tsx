'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_NID_API_URL ?? 'http://localhost:4000';

type CaseStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'NEEDS_REVIEW';
type AttemptStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';

interface AttemptSummary {
  method: string;
  status: AttemptStatus;
}

interface SessionStatus {
  status: CaseStatus;
  attempts: AttemptSummary[];
  phone: string | null;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: SessionStatus };

const TERMINAL_STATUSES: CaseStatus[] = ['APPROVED', 'REJECTED', 'EXPIRED', 'NEEDS_REVIEW'];

export default function SessionPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
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
      if (TERMINAL_STATUSES.includes(data.status)) {
        setSubmitting(false);
      }
    } catch {
      setState({ kind: 'error', message: 'Could not reach the verification service. Check your connection.' });
    }
  }, [token]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Poll while the case is still in flight, not just while this tab just
  // submitted something — the case can move on to its next method (e.g.
  // document_ocr finishing while this page is idle) and the UI needs to
  // pick that up on its own.
  useEffect(() => {
    if (state.kind !== 'ready' || TERMINAL_STATUSES.includes(state.data.status)) return;

    const interval = setInterval(() => void fetchStatus(), 2000);
    return () => clearInterval(interval);
  }, [state, fetchStatus]);

  async function submitOtp(code: string): Promise<void> {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/v1/sessions/${token}/otp/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        setSubmitError(await errorMessageFrom(res));
        setSubmitting(false);
        return;
      }
      await fetchStatus();
    } catch {
      setSubmitError('Could not reach the verification service. Check your connection.');
      setSubmitting(false);
    }
  }

  async function submitFile(method: 'document_ocr' | 'liveness', file: File): Promise<void> {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const route = method === 'document_ocr' ? 'document' : 'liveness';
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${API_URL}/v1/sessions/${token}/${route}/submit`, { method: 'POST', body });
      if (!res.ok) {
        setSubmitError(await errorMessageFrom(res));
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
            submitOtp={submitOtp}
            submitFile={submitFile}
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

async function errorMessageFrom(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
  return message ?? 'That submission did not work. Try again.';
}

function ResultView({
  data,
  submitOtp,
  submitFile,
  submitting,
  submitError,
}: {
  data: SessionStatus;
  submitOtp: (code: string) => void | Promise<void>;
  submitFile: (method: 'document_ocr' | 'liveness', file: File) => void | Promise<void>;
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
        <p className="lead">We couldn&apos;t confirm your identity. Ask whoever sent you here for a new link.</p>
      </>
    );
  }

  if (data.status === 'NEEDS_REVIEW') {
    return (
      <>
        <div className="result-icon">🕵️</div>
        <h1>We need to take a closer look</h1>
        <p className="lead">Your submission needs manual review before we can confirm it. We&apos;ll follow up.</p>
      </>
    );
  }

  if (data.status === 'EXPIRED') {
    return (
      <>
        <div className="result-icon">⏱️</div>
        <h1>This link expired</h1>
        <p className="lead">The window closed before verification finished. Ask for a new link to try again.</p>
      </>
    );
  }

  const current = data.attempts.find((a) => a.status === 'PENDING');
  const stepIndex = current ? data.attempts.indexOf(current) : -1;

  if (!current) {
    // Every attempt in the policy already resolved but the case status
    // hasn't caught up on this poll tick yet — the next tick will show the
    // terminal view above.
    return (
      <>
        <h1>Finishing up…</h1>
        <div className="status-line">
          <span className="dot pending" />
          <span>Waiting for a decision…</span>
        </div>
      </>
    );
  }

  const stepLabel =
    data.attempts.length > 1 ? <p className="step">Step {stepIndex + 1} of {data.attempts.length}</p> : null;

  if (current.method === 'otp_sms') {
    return (
      <>
        {stepLabel}
        <OtpStep phone={data.phone} onSubmit={submitOtp} submitting={submitting} submitError={submitError} />
      </>
    );
  }

  if (current.method === 'document_ocr') {
    return (
      <>
        {stepLabel}
        <UploadStep
          title="Upload your ID document"
          description="A clear photo of a government-issued ID (passport, driver's license, or national ID)."
          buttonLabel="Upload document"
          accept="image/*"
          onSubmit={(file) => submitFile('document_ocr', file)}
          submitting={submitting}
          submitError={submitError}
        />
      </>
    );
  }

  if (current.method === 'liveness') {
    return (
      <>
        {stepLabel}
        <UploadStep
          title="Take a selfie"
          description="A clear photo of your face, well-lit, looking straight at the camera."
          buttonLabel="Upload selfie"
          accept="image/*"
          onSubmit={(file) => submitFile('liveness', file)}
          submitting={submitting}
          submitError={submitError}
        />
      </>
    );
  }

  return (
    <>
      <h1>Unsupported method</h1>
      <p className="lead">This verification uses a method this page doesn&apos;t support yet ({current.method}).</p>
    </>
  );
}

function OtpStep({
  phone,
  onSubmit,
  submitting,
  submitError,
}: {
  phone: string | null;
  onSubmit: (code: string) => void | Promise<void>;
  submitting: boolean;
  submitError: string | null;
}) {
  const [code, setCode] = useState('');

  return (
    <>
      <h1>Enter your code</h1>
      <p className="lead">{phone ? `We sent a 6-digit code to ${phone}.` : 'Enter the 6-digit code you were sent.'}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(code);
        }}
      >
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

function UploadStep({
  title,
  description,
  buttonLabel,
  accept,
  onSubmit,
  submitting,
  submitError,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  accept: string;
  onSubmit: (file: File) => void | Promise<void>;
  submitting: boolean;
  submitError: string | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <h1>{title}</h1>
      <p className="lead">{description}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (file) void onSubmit(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting || !file}>
          {submitting ? 'Uploading…' : buttonLabel}
        </button>
      </form>
      {submitError && <p className="error-text">{submitError}</p>}
      {submitting && !submitError && (
        <div className="status-line">
          <span className="dot pending" />
          <span>Checking your upload…</span>
        </div>
      )}
    </>
  );
}
