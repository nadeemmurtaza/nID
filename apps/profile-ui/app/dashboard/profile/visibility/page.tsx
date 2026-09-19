'use client';

import { useDashboard } from '../../../../lib/dashboard-context';
import { VisibilityEditor } from '../../components/profile/VisibilityEditor';

export default function ProfileVisibilityPage() {
  const { token, profile, setProfile } = useDashboard();
  return <VisibilityEditor token={token} profile={profile} onSaved={setProfile} />;
}
