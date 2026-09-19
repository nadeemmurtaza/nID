'use client';

import { useDashboard } from '../../../lib/dashboard-context';
import { MessagesPanel } from '../components/MessagesPanel';

export default function MessagesPage() {
  const { token } = useDashboard();
  return <MessagesPanel token={token} />;
}
