'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MembershipInvite, getMyInvites, getMyOrganizations, getOrganizationProfile } from '../../../lib/api';
import { useDashboard } from '../../../lib/dashboard-context';
import { WorkEntry, WorkProvider } from '../../../lib/work-context';
import { SectionSidebar } from '../components/SectionSidebar';

/** The Work context's own sidebar nav -- separate from Personal's (see
 * ../personal/layout.tsx). Unlike Personal's fixed two items, Work's
 * sidebar is built from the account's actual organizations: Overview,
 * plus one nav entry per organization -- each organization's work
 * profile genuinely gets its own sidebar entry. */
export default function WorkLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { token } = useDashboard();
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [invites, setInvites] = useState<MembershipInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    const [myInvites, orgs] = await Promise.all([getMyInvites(token), getMyOrganizations(token)]);
    setInvites(myInvites);
    const withProfiles = await Promise.all(
      orgs.map(async (organization) => ({ organization, profile: await getOrganizationProfile(token, organization.id) })),
    );
    setEntries(withProfiles);
  }

  useEffect(() => {
    reload()
      .catch(() => setError('Could not load your work profiles.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const items = [
    { href: '/dashboard/work/overview', label: 'Overview' },
    ...entries.map((entry) => ({
      href: `/dashboard/work/${entry.organization.id}`,
      label: entry.organization.legalName,
    })),
  ];

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
        <SectionSidebar title="Work" items={items} pathname={pathname} />
        <div className="dashboard-content">
          <div className="tab-panel">
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            {children}
          </div>
        </div>
      </div>
    </WorkProvider>
  );
}
