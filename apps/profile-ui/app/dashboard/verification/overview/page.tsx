'use client';

import { useDashboard } from '../../../../lib/dashboard-context';
import { VerificationOverview } from '../../components/verification/VerificationOverview';

export default function VerificationOverviewPage() {
  const { token } = useDashboard();
  return <VerificationOverview token={token} />;
}
