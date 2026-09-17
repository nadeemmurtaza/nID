'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch, type SubjectBadges, type VerificationCaseDetail } from '../../../lib/api-client';
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
  const [badges, setBadges] = useState<SubjectBadges | null>(null);
  const [badgesError, setBadgesError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<VerificationCaseDetail>(`/v1/verification-cases/${caseId}`, apiKey)
      .then(setKase)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load this case.'));
  }, [apiKey, caseId]);

  useEffect(() => {
    if (!kase) return;
    apiFetch<SubjectBadges>(`/v1/subjects/${kase.subject.id}/badges`, apiKey)
      .then(setBadges)
      .catch((e: unknown) => setBadgesError(e instanceof Error ? e.message : 'Could not load badges.'));
  }, [apiKey, kase]);

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

          <h2>Badges</h2>
          {badgesError && <p className="error-text">{badgesError}</p>}
          {!badgesError && !badges && <p className="lead">Loading badges…</p>}
          {badges && <BadgesPanel badges={badges.badges} />}

          <dl className="detail-grid">
            <dt>This case verifies</dt>
            <dd>
              {kase.claimType} <span className={`badge ${kase.level}`}>{kase.level}</span>
            </dd>
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

const ALL_CLAIM_TYPES: SubjectBadges['badges'][number]['claimType'][] = [
  'IDENTITY',
  'DATE_OF_BIRTH',
  'EDUCATION',
  'EMPLOYMENT',
];

const CLAIM_TYPE_LABEL: Record<SubjectBadges['badges'][number]['claimType'], string> = {
  IDENTITY: 'Identity',
  DATE_OF_BIRTH: 'Date of birth',
  EDUCATION: 'Education',
  EMPLOYMENT: 'Employment',
};

/**
 * One slot per ClaimType, always in the same order, so a subject's badge
 * wall reads the same across cases — a claim with no passed case yet shows
 * "Not verified" rather than disappearing, so it's clear it was checked for
 * and not just absent from this particular case's policy.
 */
function BadgesPanel({ badges }: { badges: SubjectBadges['badges'] }) {
  const byType = new Map(badges.map((b) => [b.claimType, b]));

  return (
    <div className="badges-panel">
      {ALL_CLAIM_TYPES.map((claimType) => {
        const badge = byType.get(claimType);
        return (
          <div key={claimType} className={`claim-badge${badge ? '' : ' unverified'}`}>
            <span className="claim-name">{CLAIM_TYPE_LABEL[claimType]}</span>
            {badge ? (
              <span className={`badge ${badge.level}`}>{badge.level}</span>
            ) : (
              <span>Not verified</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
