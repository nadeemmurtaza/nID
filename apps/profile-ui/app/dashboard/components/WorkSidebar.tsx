'use client';

import Link from 'next/link';
import { WorkIcon } from './icons';
import type { WorkEntry } from '../../../lib/work-context';

interface Props {
  entries: WorkEntry[];
  pathname: string | null;
}

/** The Work section's own sidebar -- separate from Personal's
 * (DashboardNav.tsx), each reachable via the TopBar's Personal/Work
 * switch. Unlike Personal's fixed item list, this one is built from the
 * account's actual organizations: Overview, plus one real entry per
 * organization the account belongs to. */
export function WorkSidebar({ entries, pathname }: Props) {
  const items = [
    { href: '/dashboard/work', label: 'Overview' },
    ...entries.map((e) => ({ href: `/dashboard/work/${e.membership.organizationId}`, label: e.membership.organizationName })),
  ];

  return (
    <nav className="dashboard-nav" aria-label="Work profile sections">
      <div className="dashboard-nav-header">
        <WorkIcon />
        <span className="brand">Work</span>
      </div>

      <div className="tabs">
        {items.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`tab-btn${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
