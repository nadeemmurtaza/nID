'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch, type VerificationCaseDetail } from '../../../lib/api-client';
import { useDashboardSession } from '../../../lib/use-dashboard-session';
import { Header } from '../../components/header';
import { subjectName } from '../../format';

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const { state } = useDashboardSession();

  if (state.kind === 'checking') {
    return (
      <div className="login-wrap">
        <p className="lead">Checking for a saved session…</p>
      </div>
    );
  }

  if (state.kind === 'signed-out') {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>Sign in required</h1>
          <p className="lead">
            <Link href="/">Go back and sign in</Link> to view this case.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header tenant={state.tenant} onLogout={() => window.location.assign('/')} />
      <main className="shell">
        <CaseDetail apiKey={state.apiKey} caseId={params.id} />
      </main>
    </>
  );
}

function CaseDetail({ apiKey, caseId }: { apiKey: string; caseId: string }) {
  const [kase, setKase] = useState<VerificationCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<VerificationCaseDetail>(`/v1/verification-cases/${caseId}`, apiKey)
      .then(setKase)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load this case.'));
  }, [apiKey, caseId]);

  return (
    <>
      <Link className="back-link" href="/">
        ← All cases
      </Link>

      {error && <p className="error-text">{error}</p>}
      {!error && !kase && <p className="lead">Loading…</p>}

      {kase && (
        <>
          <h1>{subjectName(kase.subject)}</h1>
          <dl className="detail-grid">
            <dt>Status</dt>
            <dd>
              <span className={`badge ${kase.status}`}>{kase.status}</span>
            </dd>
            <dt>Subject type</dt>
            <dd>{kase.subject.type}</dd>
            <dt>Phone</dt>
            <dd>{kase.subject.phone ?? '—'}</dd>
            <dt>Email</dt>
            <dd>{kase.subject.email ?? '—'}</dd>
            <dt>Decision</dt>
            <dd>{kase.decision ?? '—'}</dd>
            <dt>Created</dt>
            <dd>{new Date(kase.createdAt).toLocaleString()}</dd>
            <dt>Resolved</dt>
            <dd>{kase.resolvedAt ? new Date(kase.resolvedAt).toLocaleString() : '—'}</dd>
            <dt>Case ID</dt>
            <dd>
              <code>{kase.id}</code>
            </dd>
          </dl>

          <h2>Verification attempts</h2>
          {kase.attempts.length === 0 ? (
            <p className="empty-state">No attempts yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {kase.attempts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.method}</td>
                    <td>{a.status}</td>
                    <td>{new Date(a.startedAt).toLocaleString()}</td>
                    <td>{a.completedAt ? new Date(a.completedAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}
