'use client';

import { useDashboard } from '../../../lib/dashboard-context';
import { ImagesManager } from '../components/ImagesManager';

export default function ImagesPage() {
  const { token, profile } = useDashboard();
  return <ImagesManager token={token} slug={profile.slug} />;
}
