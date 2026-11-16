'use client';

import { Skeleton } from '@newax/design-tokens/Skeleton';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/profile');
  }, [router]);

  return (
    <main className="center-page">
      <div aria-busy="true" aria-label="Loading"><Skeleton count={3} /></div>
    </main>
  );
}
