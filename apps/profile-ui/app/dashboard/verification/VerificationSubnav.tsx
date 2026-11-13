'use client';

import Link from 'next/link';

const STEPS = [
  { href: '/dashboard/verification/overview', label: 'Overview' },
  { href: '/dashboard/verification/email', label: 'Email' },
  { href: '/dashboard/verification/identity', label: 'Identity' },
  { href: '/dashboard/verification/cnic-phone', label: 'CNIC + Phone' },
  { href: '/dashboard/verification/privacy', label: 'Privacy' },
] as const;

export function VerificationSubnav({ pathname }: { pathname: string | null }) {
  return (
    <nav className="subnav" aria-label="Verification sections">
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
