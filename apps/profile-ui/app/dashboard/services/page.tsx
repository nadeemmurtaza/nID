'use client';

import { useDashboard } from '../../../lib/dashboard-context';
import { ServicesManager } from '../components/ServicesManager';

export default function ServicesPage() {
  const { token } = useDashboard();
  return <ServicesManager token={token} />;
}
