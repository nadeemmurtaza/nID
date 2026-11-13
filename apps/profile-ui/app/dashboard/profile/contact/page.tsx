'use client';

import { useDashboard } from '../../../../lib/dashboard-context';
import { ContactEditor } from '../../components/profile/ContactEditor';

export default function ProfileContactPage() {
  const { token, profile, setProfile } = useDashboard();
  return <ContactEditor token={token} profile={profile} onSaved={setProfile} />;
}
