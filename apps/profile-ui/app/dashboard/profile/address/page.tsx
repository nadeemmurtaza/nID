'use client';

import { useDashboard } from '../../../../lib/dashboard-context';
import { AddressEditor } from '../../components/profile/AddressEditor';

export default function ProfileAddressPage() {
  const { token, profile, setProfile } = useDashboard();
  return <AddressEditor token={token} profile={profile} onSaved={setProfile} />;
}
