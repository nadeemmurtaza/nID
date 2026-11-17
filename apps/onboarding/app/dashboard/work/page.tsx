'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** /dashboard/work itself carries no content -- it redirects to its first
 * section so the sidebar always has something active under it. */
export default function WorkIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/work/overview');
  }, [router]);
  return null;
}
