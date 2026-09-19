'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** /dashboard/profile has no content of its own — it's the section's
 * landing point, which resolves to its first real step. */
export default function ProfileIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/profile/basics');
  }, [router]);
  return null;
}
