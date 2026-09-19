'use client';

import { useDashboard } from '../../../../lib/dashboard-context';
import { BasicsEditor } from '../../components/profile/BasicsEditor';

export default function ProfileBasicsPage() {
  const { token, profile, setProfile } = useDashboard();
  return <BasicsEditor token={token} profile={profile} onSaved={setProfile} />;
}
