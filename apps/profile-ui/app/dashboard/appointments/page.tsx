'use client';

import { useDashboard } from '../../../lib/dashboard-context';
import { AppointmentsPanel } from '../components/AppointmentsPanel';

export default function AppointmentsPage() {
  const { token } = useDashboard();
  return <AppointmentsPanel token={token} />;
}
