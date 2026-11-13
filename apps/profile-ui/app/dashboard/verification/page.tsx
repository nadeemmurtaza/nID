'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VerificationIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/verification/overview');
  }, [router]);
  return null;
}
