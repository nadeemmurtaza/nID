'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '../../../../lib/api';
import {
  createVerificationCase,
  listVerificationCases,
  type SelfServicePolicy,
  type SelfServiceVerificationCase,
} from '../../../../lib/owner-api';

interface Props {
  token: string;
  policyName: SelfServicePolicy;
  title: string;
  description: string;
  /** cnic-phone-link needs the CNIC (estamp_registry's referenceId) at case-creation time — identity does not. */
  requiresReferenceId?: boolean;
  referenceIdLabel?: string;
}

/**
 * Shared by the Identity and CNIC+Phone pages — same "start a check, get
 * redirected to apps/verify-ui to actually do it, see your case history"
 * shape for both, just a different policy/required input. Deliberately
 * does NOT rebuild document-upload/liveness-capture/OTP UI here: that
 * already exists, is well-tested, and apps/verify-ui's hostedUrl (the same
 * one a tenant's own case creation already returns) is where it lives —
 * this component's only job is starting the case and handing the owner
 * off to it.
 */
export function SelfServiceCheck({ token, policyName, title, description, requiresReferenceId, referenceIdLabel }: Props) {
  const [cases, setCases] = useState<SelfServiceVerificationCase[] | null>(null);
  const [referenceId, setReferenceId] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listVerificationCases(token)
      .then((all) => setCases(all.filter((c) => c.policy?.name === policyName)))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your case history.'));
  }, [token, policyName]);

  async function start(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (requiresReferenceId && !referenceId.trim()) {
      setError(`${referenceIdLabel ?? 'This field'} is required.`);
      return;
    }
    setStarting(true);
    try {
      const created = await createVerificationCase(token, policyName, requiresReferenceId ? referenceId.trim() : undefined);
      if (created.hostedUrl) {
        window.location.href = created.hostedUrl;
        return;
      }
      setError('The check was created but no hosted link came back — try again.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start this check.');
    } finally {
      setStarting(false);
    }
  }

  const hasActiveCase = cases?.some((c) => c.status === 'PENDING' || c.status === 'IN_REVIEW' || c.status === 'NEEDS_REVIEW');

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        {title}
      </h2>
      <p className="meta" style={{ marginBottom: 16 }}>
        {description}
      </p>

      <form onSubmit={start} className="section-card">
        {requiresReferenceId && (
          <>
            <label htmlFor="referenceId">{referenceIdLabel}</label>
            <input id="referenceId" type="text" value={referenceId} onChange={(e) => setReferenceId(e.target.value)} />
          </>
        )}
        <button type="submit" className="btn btn-primary" style={{ marginTop: requiresReferenceId ? 12 : 0 }} disabled={starting}>
          {starting ? 'Starting…' : hasActiveCase ? 'Start another check' : 'Start check'}
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>

      <h3 className="section-title">History</h3>
      {cases === null ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : cases.length === 0 ? (
        <div className="empty-state">No checks started yet.</div>
      ) : (
        <div className="section-card">
          {cases.map((c) => (
            <div className="data-row" key={c.id}>
              <span>
                {new Date(c.createdAt).toLocaleString()}
                {c.attempts.length > 0 && <div className="meta">{c.attempts.map((a) => a.method).join(', ')}</div>}
              </span>
              <span className={`status-pill ${c.status}`}>{c.status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
