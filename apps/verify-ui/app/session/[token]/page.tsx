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

/** Route segment for each single-file upload method's submit endpoint — liveness has its own
 * multi-frame route (submitFrames below), the per-claim document methods share one generic route. */
const UPLOAD_ROUTE_FOR_METHOD: Record<string, string> = {
  document_ocr: 'document',
  dob_document: 'claims/dob_document',
  education_document: 'claims/education_document',
  employment_document: 'claims/employment_document',
};

/** education_registry / employment_registry resolve automatically, server-side — no upload here. */
const REGISTRY_CHECK_METHODS = new Set(['education_registry', 'employment_registry']);
/** ecp_voter_registration — the subject types back what a government SMS shortcode told them; see SelfReportedCheckProvider. */
const SELF_REPORT_METHODS = new Set(['ecp_voter_registration']);

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

  async function submitReport(method: string, reportedValue: string): Promise<void> {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/v1/sessions/${token}/claims/${method}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reportedValue }),
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

  async function submitFile(method: string, file: File): Promise<void> {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const route = UPLOAD_ROUTE_FOR_METHOD[method] ?? `claims/${method}`;
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

  /** liveness only — a burst of frames, not one file. See LivenessStep and SessionsService.submitLiveness(). */
  async function submitFrames(frames: Blob[]): Promise<void> {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const body = new FormData();
      frames.forEach((frame, i) => body.append('frames', frame, `frame-${i}.jpg`));
      const res = await fetch(`${API_URL}/v1/sessions/${token}/liveness/submit`, { method: 'POST', body });
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
            submitFrames={submitFrames}
            submitReport={submitReport}
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
  submitFrames,
  submitReport,
  submitting,
  submitError,
}: {
  data: SessionStatus;
  submitOtp: (code: string) => void | Promise<void>;
  submitFile: (method: string, file: File) => void | Promise<void>;
  submitFrames: (frames: Blob[]) => void | Promise<void>;
  submitReport: (method: string, reportedValue: string) => void | Promise<void>;
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

  if (current.method === 'liveness') {
    return (
      <>
        {stepLabel}
        <LivenessStep onSubmit={submitFrames} submitting={submitting} submitError={submitError} />
      </>
    );
  }

  const uploadConfig = UPLOAD_STEP_CONFIG[current.method];
  if (uploadConfig) {
    return (
      <>
        {stepLabel}
        <UploadStep
          {...uploadConfig}
          accept="image/*"
          onSubmit={(file) => submitFile(current.method, file)}
          submitting={submitting}
          submitError={submitError}
        />
      </>
    );
  }

  if (REGISTRY_CHECK_METHODS.has(current.method)) {
    return (
      <>
        {stepLabel}
        <h1>Checking with the registry…</h1>
        <p className="lead">We&apos;re confirming this automatically — nothing to do here.</p>
        <div className="status-line">
          <span className="dot pending" />
          <span>This can take a moment</span>
        </div>
      </>
    );
  }

  const reportConfig = SELF_REPORT_STEP_CONFIG[current.method];
  if (SELF_REPORT_METHODS.has(current.method) && reportConfig) {
    return (
      <>
        {stepLabel}
        <TextReportStep
          {...reportConfig}
          onSubmit={(value) => submitReport(current.method, value)}
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

const UPLOAD_STEP_CONFIG: Record<string, { title: string; description: string; buttonLabel: string }> = {
  document_ocr: {
    title: 'Upload your ID document',
    description: "A clear photo of a government-issued ID (passport, driver's license, or national ID).",
    buttonLabel: 'Upload document',
  },
  dob_document: {
    title: 'Upload proof of date of birth',
    description: 'A birth certificate or an ID document that shows your date of birth.',
    buttonLabel: 'Upload document',
  },
  education_document: {
    title: 'Upload your education document',
    description: 'A diploma, degree certificate, or transcript.',
    buttonLabel: 'Upload document',
  },
  employment_document: {
    title: 'Upload your employment document',
    description: 'An offer letter, pay stub, or employment verification letter.',
    buttonLabel: 'Upload document',
  },
};

const SELF_REPORT_STEP_CONFIG: Record<
  string,
  { title: string; description: string; placeholder: string; buttonLabel: string }
> = {
  ecp_voter_registration: {
    title: 'Check your voter registration',
    description:
      'Text your CNIC number to 8300 to check with the Election Commission of Pakistan, then type back exactly what they replied.',
    placeholder: 'e.g. "Registered — Lahore NA-130" or the full reply text',
    buttonLabel: 'Submit reply',
  },
};

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

/** How many frames a burst captures, and how far apart — real blink detection
 * (@nid/liveness-engine) needs an open->closed->open sequence, which needs more
 * than one snapshot; ~1.8s total gives the subject a real window to blink in. */
const LIVENESS_FRAME_COUNT = 6;
const LIVENESS_FRAME_INTERVAL_MS = 300;
/** The frame index (0-based) the "Blink now" prompt appears at — roughly the middle of the burst. */
const LIVENESS_BLINK_PROMPT_FRAME = 2;

function LivenessStep({
  onSubmit,
  submitting,
  submitError,
}: {
  onSubmit: (frames: Blob[]) => void | Promise<void>;
  submitting: boolean;
  submitError: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureIndex, setCaptureIndex] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Your browser does not support camera capture. Try a different browser or device.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setCameraReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError('Camera access was denied or unavailable. Allow camera access and reload to continue.');
        }
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function captureBurst(): Promise<void> {
    const video = videoRef.current;
    if (!video) return;

    setCapturing(true);
    const frames: Blob[] = [];
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Could not capture from the camera. Try a different browser.');
      setCapturing(false);
      return;
    }

    for (let i = 0; i < LIVENESS_FRAME_COUNT; i++) {
      setCaptureIndex(i);
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, LIVENESS_FRAME_INTERVAL_MS));
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (blob) {
        frames.push(blob);
      }
    }

    setCapturing(false);
    if (frames.length < LIVENESS_FRAME_COUNT) {
      setCameraError('Could not capture enough frames. Try again.');
      return;
    }
    await onSubmit(frames);
  }

  return (
    <>
      <h1>Take a quick liveness check</h1>
      <p className="lead">Center your face in frame, then start the capture and blink when prompted.</p>

      {cameraError && <p className="error-text">{cameraError}</p>}

      {!cameraError && (
        <div className="camera-preview">
          <video ref={videoRef} autoPlay playsInline muted />
          {capturing && captureIndex >= LIVENESS_BLINK_PROMPT_FRAME && (
            <div className="blink-prompt">Blink now</div>
          )}
        </div>
      )}

      <button type="button" onClick={() => void captureBurst()} disabled={!cameraReady || capturing || submitting}>
        {capturing
          ? `Capturing… (${captureIndex + 1}/${LIVENESS_FRAME_COUNT})`
          : submitting
            ? 'Checking…'
            : 'Start capture'}
      </button>

      {submitError && <p className="error-text">{submitError}</p>}
      {submitting && !submitError && (
        <div className="status-line">
          <span className="dot pending" />
          <span>Checking your capture…</span>
        </div>
      )}
    </>
  );
}

function TextReportStep({
  title,
  description,
  placeholder,
  buttonLabel,
  onSubmit,
  submitting,
  submitError,
}: {
  title: string;
  description: string;
  placeholder: string;
  buttonLabel: string;
  onSubmit: (value: string) => void | Promise<void>;
  submitting: boolean;
  submitError: string | null;
}) {
  const [value, setValue] = useState('');

  return (
    <>
      <h1>{title}</h1>
      <p className="lead">{description}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) void onSubmit(value.trim());
        }}
      >
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={submitting}
          autoFocus
        />
        <button type="submit" disabled={submitting || value.trim().length === 0}>
          {submitting ? 'Submitting…' : buttonLabel}
        </button>
      </form>
      {submitError && <p className="error-text">{submitError}</p>}
      {submitting && !submitError && (
        <div className="status-line">
          <span className="dot pending" />
          <span>Sending your reply…</span>
        </div>
      )}
    </>
  );
}
