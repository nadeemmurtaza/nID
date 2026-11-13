'use client';

import { useDashboard } from '../../../lib/dashboard-context';
import { HoursManager } from '../components/HoursManager';

export default function HoursPage() {
  const { token } = useDashboard();
  return <HoursManager token={token} />;
}
