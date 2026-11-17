'use client';

import { useDashboard } from '../../../../../lib/dashboard-context';
import { useWork } from '../../../../../lib/work-context';
import { OffersManager } from '../../../components/OffersManager';

export default function WorkOffersPage({ params }: { params: { organizationId: string } }) {
  const { token } = useDashboard();
  const { entries } = useWork();
  const entry = entries.find((e) => e.membership.organizationId === params.organizationId);

  if (!entry) {
    return <p className="lead">That organization isn&apos;t one you&apos;re a member of.</p>;
  }

  return (
    <div className="tab-content">
      <h1>{entry.membership.organizationName} — Offers</h1>
      <OffersManager token={token} organizationId={params.organizationId} />
    </div>
  );
}
