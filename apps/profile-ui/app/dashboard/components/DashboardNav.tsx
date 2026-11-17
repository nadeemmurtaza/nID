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
  VerificationIcon,
  ProfileIcon,
  ServicesIcon,
} from './icons';

const NAV_ITEMS = [
  { href: '/dashboard/profile', label: 'Profile', Icon: ProfileIcon },
  { href: '/dashboard/verification', label: 'Verification', Icon: VerificationIcon },
  { href: '/dashboard/services', label: 'Services', Icon: ServicesIcon },
  { href: '/dashboard/availability', label: 'Bookable hours', Icon: AvailabilityIcon },
  { href: '/dashboard/hours', label: 'Display hours', Icon: HoursIcon },
  { href: '/dashboard/offers', label: 'Offers', Icon: OffersIcon },
  { href: '/dashboard/links', label: 'Links', Icon: LinksIcon },
  { href: '/dashboard/images', label: 'Photos', Icon: ImagesIcon },
  { href: '/dashboard/appointments', label: 'Appointments', Icon: AppointmentsIcon },
  { href: '/dashboard/messages', label: 'Messages', Icon: MessagesIcon },
] as const;

interface Props {
  /** '' before the account has a profile yet -- every link still renders
   * (see app/dashboard/layout.tsx: it shows the same create-page panel for
   * any route until a profile exists, so nothing here can 404 or crash),
   * just without the "View page" link, which has nothing to point at yet. */
  slug: string;
  pathname: string | null;
}

/** The Personal section's own sidebar nav -- separate from Work's (see
 * WorkSidebar.tsx), each reachable via the TopBar's Personal/Work switch,
 * which stays visible above whichever of the two is showing. Sign out
 * moved to the TopBar (shared across both sections), so this only has
 * "View page" left in its footer. */
export function DashboardNav({ slug, pathname }: Props) {
  return (
    <nav className="dashboard-nav" aria-label="Personal profile sections">
      <div className="dashboard-nav-header">
        <Logomark size={26} />
        <span className="brand">Personal</span>
      </div>

      <div className="tabs">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          // 'Profile' and 'Verification' each have their own sub-routes —
          // stay highlighted for all of them, not just an exact match.
          const hasSubroutes = href === '/dashboard/profile' || href === '/dashboard/verification';
          const active = hasSubroutes ? pathname?.startsWith(href) ?? false : pathname === href;
          return (
            <Link key={href} href={href} className={`tab-btn${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      {slug && (
        <div className="dashboard-nav-footer">
          <a href={`/${slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            View page →
          </a>
        </div>
      )}
    </nav>
  );
}
