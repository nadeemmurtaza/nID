'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, type VerificationCaseListItem } from '../lib/api-client';
import { useDashboardSession } from '../lib/use-dashboard-session';
import { Header } from './components/header';
import { subjectName } from './format';

export default function DashboardHome() {
  const { state, login, logout, loginError, loggingIn } = useDashboardSession();

  if (state.kind === 'checking') {
    return (
      <div className="login-wrap">
        <p className="lead">Checking for a saved session…</p>
      </div>
    );
  }

  if (state.kind === 'signed-out') {
    return <LoginScreen onLogin={login} error={loginError} loading={loggingIn} />;
  }

  return (
    <>
      <Header tenant={state.tenant} onLogout={logout} />
      <main className="shell">
        <CaseList apiKey={state.apiKey} />
      </main>
    </>
  );
}

function LoginScreen({
  onLogin,
  error,
  loading,
}: {
  onLogin: (key: string) => void;
  error: string | null;
  loading: boolean;
}) {
  const [key, setKey] = useState('');

  return (
    <div className="login-wrap">
      <div className="login-card">
        <p className="brand">nID Dashboard</p>
        <h1>Sign in with your API key</h1>
        <p className="lead">
          Phase 0 has no separate staff login yet — paste the tenant API key from{' '}
          <code>pnpm db:seed</code>. It&apos;s kept only in this browser.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLogin(key.trim());
          }}
        >
          <input
            type="password"
            placeholder="nid_test_…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoFocus
          />
          {error && <p className="error-text">{error}</p>}
          <button className="primary-block" type="submit" disabled={loading || key.trim().length === 0}>
            {loading ? 'Checking…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

function CaseList({ apiKey }: { apiKey: string }) {
  const [cases, setCases] = useState<VerificationCaseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<VerificationCaseListItem[]>('/v1/verification-cases', apiKey)
      .then(setCases)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load cases.'));
  }, [apiKey]);

  if (error) return <p className="error-text">{error}</p>;
  if (!cases) return <p className="lead">Loading cases…</p>;
  if (cases.length === 0) {
    return (
      <div className="empty-state">
        No verification cases yet. Create one with <code>POST /v1/verification-cases</code>.
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>Status</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => (
          <tr key={c.id}>
            <td>
              <Link href={`/cases/${c.id}`}>{subjectName(c.subject)}</Link>
            </td>
            <td>
              <span className={`badge ${c.status}`}>{c.status}</span>
            </td>
            <td>{new Date(c.createdAt).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
