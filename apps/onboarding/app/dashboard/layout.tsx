'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Account, clearStoredAccountSession, getCurrentAccount, getStoredAccountSession } from '../../lib/api';
import { DashboardProvider } from '../../lib/dashboard-context';
import { TopBar } from './components/TopBar';

/** Owns everything every /dashboard/* route needs before it can render:
 * the session check and fetching the account once. Renders the top
 * Personal/Work switch; each of those owns its own sidebar nav in its
 * own nested layout.tsx (app/dashboard/personal, app/dashboard/work). */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredAccountSession();
    if (!stored) {
      router.replace('/signin');
      return;
    }
    getCurrentAccount(stored)
      .then((acct) => {
        setToken(stored);
        setAccount(acct);
      })
      .catch(() => {
        clearStoredAccountSession();
        setError('Your session expired. Sign in again.');
        router.replace('/signin');
      });
  }, [router]);

  function handleSignOut(): void {
    clearStoredAccountSession();
    router.push('/signin');
  }

  if (!token || !account) {
    return (
      <main>
        <div className="card">
          <p className="lead">{error ?? 'Loading your dashboards…'}</p>
        </div>
      </main>
    );
  }

  return (
    <DashboardProvider value={{ token, account, setAccount }}>
      <div className="dashboard-outer">
        <TopBar pathname={pathname} token={token} onSignOut={handleSignOut} />
        {children}
      </div>
    </DashboardProvider>
  );
}
