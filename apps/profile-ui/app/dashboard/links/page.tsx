'use client';

import { useDashboard } from '../../../lib/dashboard-context';
import { LinksManager } from '../components/LinksManager';

export default function LinksPage() {
  const { token } = useDashboard();
  return <LinksManager token={token} />;
}
