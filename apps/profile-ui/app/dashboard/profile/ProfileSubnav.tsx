'use client';

import Link from 'next/link';

const STEPS = [
  { href: '/dashboard/profile/basics', label: 'Basics' },
  { href: '/dashboard/profile/contact', label: 'Contact' },
  { href: '/dashboard/profile/address', label: 'Address' },
  { href: '/dashboard/profile/visibility', label: 'Visibility' },
] as const;

/** One step per page, not one long form — each link is a real route
 * (usePathname-driven active state), so refresh/back/forward/deep-linking
 * all work the same way the top-level DashboardNav already does. */
export function ProfileSubnav({ pathname }: { pathname: string | null }) {
  return (
    <nav className="subnav" aria-label="Profile sections">
      {STEPS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} className={`subnav-btn${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
