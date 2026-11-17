'use client';

import Link from 'next/link';
import { profileDashboardUrl } from '../../../lib/api';

interface Props {
  pathname: string | null;
  token: string;
  onSignOut: () => void;
}

/** Always-visible top bar: brand, the Personal/Work context switch, and
 * sign out. "Personal" hands off to apps/profile-ui's real dashboard
 * (there's no internal page for it here -- the personal profile
 * dashboard lives there, not as a copy in this app). "Work" is this
 * app's own section, with its own sidebar nav below this -- see its
 * layout.tsx and SectionSidebar. */
export function TopBar({ pathname, token, onSignOut }: Props) {
  const isAccount = pathname === '/dashboard/account';
  const isWork = !isAccount && (pathname?.startsWith('/dashboard/work') ?? false);

  return (
    <header className="dashboard-topbar">
      <span className="brand" style={{ margin: 0 }}>
        NID
      </span>
      <nav className="view-tabs" aria-label="Profile context">
        <a href={profileDashboardUrl(token)} className="view-tab">
          Personal
        </a>
        <Link href="/dashboard/work" className={`view-tab${isWork ? ' active' : ''}`} aria-current={isWork ? 'page' : undefined}>
          Work
        </Link>
      </nav>
      <div style={{ display: 'flex', gap: 8 }}>
        <Link href="/dashboard/account" className={`topbar-link${isAccount ? ' active' : ''}`} aria-current={isAccount ? 'page' : undefined}>
          Account
        </Link>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
