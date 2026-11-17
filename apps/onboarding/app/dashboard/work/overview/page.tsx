'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApiError, acceptInvite, declineInvite } from '../../../../lib/api';
import { useDashboard } from '../../../../lib/dashboard-context';
import { useWork } from '../../../../lib/work-context';

export default function WorkOverviewPage() {
  const { token } = useDashboard();
  const { invites, entries, reload } = useWork();
  const [error, setError] = useState<string | null>(null);

  async function respond(membershipId: string, accept: boolean): Promise<void> {
    setError(null);
    try {
      await (accept ? acceptInvite(token, membershipId) : declineInvite(token, membershipId));
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not respond to that invitation.');
    }
  }

  return (
    <section>
      <h1>Work profiles</h1>
      <p className="lead">
        The organizations you belong to, and their public profiles. Organizations themselves are created by a
        tenant, not here — you join one via an invitation. Each organization you belong to gets its own section in
        the sidebar on the left.
      </p>

      {invites.length > 0 && (
        <div className="account-section">
          <p className="account-section-title">Pending invitations</p>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          {invites.map((invite) => (
            <div className="account-chip" key={invite.id}>
              <span className="account-chip-label">{invite.role}</span>
              <span className="account-chip-value">Organization {invite.organizationId}</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => respond(invite.id, true)} style={{ width: 'auto' }}>
                  Accept
                </button>
                <button type="button" className="secondary" onClick={() => respond(invite.id, false)} style={{ width: 'auto' }}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="account-section">
        <p className="account-section-title">Your organizations</p>
        {entries.length === 0 && <p className="lead">You&apos;re not a member of any organization yet.</p>}
        {entries.map(({ organization, profile }) => (
          <Link key={organization.id} href={`/dashboard/work/${organization.id}`} className="account-chip" style={{ textDecoration: 'none' }}>
            <span className="account-chip-label">{organization.legalName}</span>
            <span className="account-chip-value">{profile ? profile.displayName : 'No public profile yet — set one up →'}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
