'use client';

import { useDashboard } from '../../../../../lib/dashboard-context';
import { useWork } from '../../../../../lib/work-context';
import { ImagesManager } from '../../../components/ImagesManager';

export default function WorkPhotosPage({ params }: { params: { organizationId: string } }) {
  const { token } = useDashboard();
  const { entries } = useWork();
  const entry = entries.find((e) => e.membership.organizationId === params.organizationId);

  if (!entry) {
    return <p className="lead">That organization isn&apos;t one you&apos;re a member of.</p>;
  }
  if (!entry.profile) {
    return <p className="lead">Set up this organization&apos;s public profile first.</p>;
  }

  return (
    <div className="tab-content">
      <h1>{entry.membership.organizationName} — Photos</h1>
      <ImagesManager token={token} slug={entry.profile.slug} organizationId={params.organizationId} />
    </div>
  );
}
