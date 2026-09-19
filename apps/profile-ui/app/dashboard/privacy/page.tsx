'use client';

import { useDashboard } from '../../../lib/dashboard-context';
import { GrantsManager } from '../components/GrantsManager';

export default function PrivacyPage() {
  const { token } = useDashboard();
  return <GrantsManager token={token} />;
}
