'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/profile');
  }, [router]);

  return (
    <main className="center-page">
      <p style={{ color: 'var(--muted)' }}>Loading…</p>
    </main>
  );
}
