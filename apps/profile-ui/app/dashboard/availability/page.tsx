'use client';

import { useDashboard } from '../../../lib/dashboard-context';
import { AvailabilityManager } from '../components/AvailabilityManager';

export default function AvailabilityPage() {
  const { token } = useDashboard();
  return <AvailabilityManager token={token} />;
}
