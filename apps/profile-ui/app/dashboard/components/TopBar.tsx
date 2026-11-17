'use client';

import Link from 'next/link';

interface Props {
  pathname: string | null;
  onSignOut: () => void;
}

/** Always visible on every /dashboard/* page (rendered once, in
 * app/dashboard/layout.tsx, above whichever section is active) -- the
 * Personal/Work switch lives here, centered, so it never disappears no
 * matter which page within either section you're on. Account and Sign
 * out sit on the right, outside both sections, since neither is
 * Personal- or Work-specific. */
export function TopBar({ pathname, onSignOut }: Props) {
  const isAccount = pathname === '/dashboard/account';
  const isWork = !isAccount && (pathname?.startsWith('/dashboard/work') ?? false);
  const isPersonal = !isAccount && !isWork;

  return (
    <header className="dashboard-topbar">
      <span className="brand" style={{ margin: 0 }}>
        NID
      </span>
      <nav className="subnav" aria-label="Profile context">
        <Link href="/dashboard/profile" className={`subnav-btn${isPersonal ? ' active' : ''}`} aria-current={isPersonal ? 'page' : undefined}>
          Personal
        </Link>
        <Link href="/dashboard/work" className={`subnav-btn${isWork ? ' active' : ''}`} aria-current={isWork ? 'page' : undefined}>
          Work
        </Link>
      </nav>
      <div style={{ display: 'flex', gap: 8 }}>
        <Link href="/dashboard/account" className={`topbar-link${isAccount ? ' active' : ''}`} aria-current={isAccount ? 'page' : undefined}>
          Account
        </Link>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
