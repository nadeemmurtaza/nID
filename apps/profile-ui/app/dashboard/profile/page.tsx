'use client';

import { useDashboard } from '../../../lib/dashboard-context';
import { ProfileEditor } from '../components/ProfileEditor';

export default function ProfilePage() {
  const { token, profile, setProfile } = useDashboard();
  return <ProfileEditor token={token} profile={profile} onSaved={setProfile} />;
}
