'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredAccountSession } from '../lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getStoredAccountSession() ? '/dashboard' : '/signup');
  }, [router]);

  return null;
}
