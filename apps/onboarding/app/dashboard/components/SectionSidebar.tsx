'use client';

import Link from 'next/link';

export interface SidebarItem {
  href: string;
  label: string;
}

interface Props {
  title: string;
  items: SidebarItem[];
  pathname: string | null;
}

/** Generic left sidebar nav, reused by both app/dashboard/personal's and
 * app/dashboard/work's own layout.tsx -- each context gets its own
 * instance with its own items, so Personal and Work each have their own
 * sidebar nav rather than sharing one flat list. */
export function SectionSidebar({ title, items, pathname }: Props) {
  return (
    <nav className="dashboard-nav" aria-label={`${title} sections`}>
      <div className="dashboard-nav-header">
        <span className="brand" style={{ margin: 0 }}>
          {title}
        </span>
      </div>

      <div className="dashboard-tabs">
        {items.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`tab-btn${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
