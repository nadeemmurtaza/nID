'use client';

import { useDashboard } from '../../../lib/dashboard-context';
import { OffersManager } from '../components/OffersManager';

export default function OffersPage() {
  const { token } = useDashboard();
  return <OffersManager token={token} />;
}
