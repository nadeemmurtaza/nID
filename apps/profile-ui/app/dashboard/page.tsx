'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** /dashboard has no content of its own — the layout already resolved auth
 * and the first-run profile gate by the time this renders, so this just
 * sends the owner to the first real section. */
export default function DashboardIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/profile');
  }, [router]);

  return null;
}
