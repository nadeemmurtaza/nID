'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getMe, getMyProfile, type OwnerProfile } from '../../lib/owner-api';
import { clearStoredAccountSession, getStoredAccountSession } from '../../lib/session';
import { DashboardProvider } from '../../lib/dashboard-context';
import { CreateProfileForm } from './components/CreateProfileForm';
import { DashboardNav } from './components/DashboardNav';

/** Owns everything every /dashboard/* route needs before it can render:
 * the session check, the first-run "no profile yet" gate, and fetching the
 * profile once. Real children (the per-section pages) only mount once a
 * token and a profile both exist, and get both back out via
 * lib/dashboard-context so nothing has to re-fetch.
 *
 * app/dashboard/login is a route NESTED under this same layout (Next.js
 * applies a segment's layout.tsx to every route below it, including
 * sibling-looking ones like /dashboard/login) — it is NOT excluded just by
 * living in its own subfolder. Without the isLoginRoute bypass below, an
 * unauthenticated visitor hits the "no token yet" branch, which used to
 * render nothing but "Loading…" forever, permanently hiding the very login
 * form that would let them get a token — the gate blocked its own escape
 * hatch. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname === '/dashboard/login';
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<OwnerProfile | null | undefined>(undefined);

  useEffect(() => {
    if (isLoginRoute) return;
    const stored = getStoredAccountSession();
    if (!stored) {
      router.replace('/dashboard/login');
      return;
    }
    getMe(stored)
      .then(() => {
        setToken(stored);
        return getMyProfile(stored);
      })
      .then((p) => setProfile(p))
      .catch(() => {
        clearStoredAccountSession();
        router.replace('/dashboard/login');
      });
  }, [router, isLoginRoute]);

  function handleSignOut(): void {
    clearStoredAccountSession();
    router.replace('/dashboard/login');
  }

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (!token || profile === undefined) {
    return (
      <main className="center-page">
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </main>
    );
  }

  if (!profile) {
    return <CreateProfileForm token={token} onCreated={setProfile} />;
  }

  return (
    <DashboardProvider value={{ token, profile, setProfile }}>
      <div className="dashboard-shell">
        <DashboardNav slug={profile.slug} pathname={pathname} onSignOut={handleSignOut} />
        <div className="dashboard-content">
          <div className="tab-panel">{children}</div>
        </div>
      </div>
    </DashboardProvider>
  );
}
