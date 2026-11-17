'use client';

import { Skeleton } from '@newax/design-tokens/Skeleton';
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
 * sibling-looking ones like /dashboard/login), it is NOT excluded just by
 * living in its own subfolder. Without the isLoginRoute bypass below, an
 * unauthenticated visitor hits the "no token yet" branch, which used to
 * render nothing but "Loading…" forever, permanently hiding the very login
 * form that would let them get a token, the gate blocked its own escape
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
        <div aria-busy="true" aria-label="Loading"><Skeleton count={3} /></div>
      </main>
    );
  }

  if (!profile) {
    // The dashboard itself is still the first thing shown after login --
    // creating the public page is just this shell's content until that's
    // done, not a separate full-screen wizard in front of it. The full
    // nav is shown too (slug='' just hides "View page", which has
    // nothing to point at yet): every other item is still safe to click
    // because this whole branch applies to every /dashboard/* route --
    // `children` (the real per-section pages, which assume a profile via
    // DashboardProvider) never renders until profile is actually set, no
    // matter which nav link was followed to get here.
    return (
      <div className="dashboard-shell">
        <DashboardNav slug="" pathname={pathname} onSignOut={handleSignOut} />
        <div className="dashboard-content">
          <div className="tab-panel">
            <CreateProfileForm token={token} onCreated={setProfile} />
          </div>
        </div>
      </div>
    );
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
