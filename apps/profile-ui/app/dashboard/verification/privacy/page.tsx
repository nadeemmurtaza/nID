'use client';

import { useDashboard } from '../../../../lib/dashboard-context';
import { GrantsManager } from '../../components/GrantsManager';

export default function VerificationPrivacyPage() {
  const { token } = useDashboard();
  return <GrantsManager token={token} />;
}
