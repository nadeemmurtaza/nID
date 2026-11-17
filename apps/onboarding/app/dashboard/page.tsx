'use client';

import { useEffect } from 'react';
import { profileDashboardUrl } from '../../lib/api';
import { useDashboard } from '../../lib/dashboard-context';

/** /dashboard itself carries no content -- Personal's real dashboard lives
 * in apps/profile-ui (see TopBar's "Personal" link), so landing here with
 * no more specific route goes straight there rather than to a page of
 * its own in this app. */
export default function DashboardIndexPage() {
  const { token } = useDashboard();
  useEffect(() => {
    window.location.href = profileDashboardUrl(token);
  }, [token]);
  return null;
}
