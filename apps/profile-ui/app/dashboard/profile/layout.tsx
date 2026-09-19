'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ProfileSubnav } from './ProfileSubnav';

export default function ProfileLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <ProfileSubnav pathname={pathname} />
      {children}
    </div>
  );
}
