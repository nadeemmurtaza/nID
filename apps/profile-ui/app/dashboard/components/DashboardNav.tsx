'use client';

import Link from 'next/link';
import { Logomark } from '../../components/logomark';
import {
  AppointmentsIcon,
  AvailabilityIcon,
  HoursIcon,
  ImagesIcon,
  LinksIcon,
  MessagesIcon,
  OffersIcon,
  PrivacyIcon,
  ProfileIcon,
  ServicesIcon,
} from './icons';

const NAV_ITEMS = [
  { href: '/dashboard/profile', label: 'Profile', Icon: ProfileIcon },
  { href: '/dashboard/services', label: 'Services', Icon: ServicesIcon },
  { href: '/dashboard/availability', label: 'Bookable hours', Icon: AvailabilityIcon },
  { href: '/dashboard/hours', label: 'Display hours', Icon: HoursIcon },
  { href: '/dashboard/offers', label: 'Offers', Icon: OffersIcon },
  { href: '/dashboard/links', label: 'Links', Icon: LinksIcon },
  { href: '/dashboard/images', label: 'Photos', Icon: ImagesIcon },
  { href: '/dashboard/appointments', label: 'Appointments', Icon: AppointmentsIcon },
  { href: '/dashboard/messages', label: 'Messages', Icon: MessagesIcon },
  { href: '/dashboard/privacy', label: 'Private shares', Icon: PrivacyIcon },
] as const;

interface Props {
  slug: string;
  pathname: string | null;
  onSignOut: () => void;
}

/** The persistent dashboard app shell: a brand header, one link per dashboard
 * route (reusing the app's existing .tabs/.tab-btn visual style — a
 * horizontally-scrolling strip on narrow screens, a proper left sidebar from
 * 880px up via the media query in globals.css), and sign-out/view-page
 * actions. Active state is driven by the real route (usePathname in the
 * layout), not client-side tab state. */
export function DashboardNav({ slug, pathname, onSignOut }: Props) {
  return (
    <nav className="dashboard-nav" aria-label="Dashboard sections">
      <div className="dashboard-nav-header">
        <Logomark size={26} />
        <span className="brand">nID Profiles</span>
      </div>

      <div className="tabs">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          // 'Profile' has its own sub-routes (basics/contact/address/
          // visibility) — stays highlighted for all of them, not just an
          // exact match.
          const active = href === '/dashboard/profile' ? pathname?.startsWith(href) ?? false : pathname === href;
          return (
            <Link key={href} href={href} className={`tab-btn${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="dashboard-nav-footer">
        <a href={`/${slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
          View page →
        </a>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
