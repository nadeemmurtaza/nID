'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getMyInvites, getMyOrganizationMemberships, getOrganizationProfile } from '../../../lib/owner-api';
import { useDashboard } from '../../../lib/dashboard-context';
import { WorkEntry, WorkProvider } from '../../../lib/work-context';
import { WorkSidebar } from '../components/WorkSidebar';

/** Owns the Work section's own shell (sidebar + content), separate from
 * Personal's (app/dashboard/layout.tsx's DashboardNav) -- the outer
 * layout renders only the shared TopBar for /dashboard/work/* and leaves
 * the rest to this nested layout, so Work's sidebar is never the
 * Personal one with extra items bolted on. */
export default function WorkLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { token } = useDashboard();
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [invites, setInvites] = useState<Awaited<ReturnType<typeof getMyInvites>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    const [myInvites, memberships] = await Promise.all([getMyInvites(token), getMyOrganizationMemberships(token)]);
    setInvites(myInvites);
    const withProfiles = await Promise.all(
      memberships.map(async (membership) => ({ membership, profile: await getOrganizationProfile(token, membership.organizationId) })),
    );
    setEntries(withProfiles);
  }

  useEffect(() => {
    reload()
      .catch(() => setError('Could not load your work profiles.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <div className="dashboard-shell">
        <div className="dashboard-content">
          <div className="tab-panel">
            <p className="lead">Loading your work profiles…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <WorkProvider value={{ invites, entries, reload }}>
      <div className="dashboard-shell">
        <WorkSidebar entries={entries} pathname={pathname} />
        <div className="dashboard-content">
          <div className="tab-panel">
            {error && <p className="error-text">{error}</p>}
            {children}
          </div>
        </div>
      </div>
    </WorkProvider>
  );
}
