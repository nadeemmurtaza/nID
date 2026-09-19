'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { VerificationSubnav } from './VerificationSubnav';

export default function VerificationLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <VerificationSubnav pathname={pathname} />
      {children}
    </div>
  );
}
