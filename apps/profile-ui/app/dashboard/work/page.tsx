'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApiError, acceptInvite, declineInvite } from '../../../lib/owner-api';
import { useDashboard } from '../../../lib/dashboard-context';
import { useWork } from '../../../lib/work-context';

export default function WorkPage() {
  const { token } = useDashboard();
  const { invites, entries, reload } = useWork();
  const [actionError, setActionError] = useState<string | null>(null);

  async function respond(membershipId: string, accept: boolean): Promise<void> {
    setActionError(null);
    try {
      await (accept ? acceptInvite(token, membershipId) : declineInvite(token, membershipId));
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not respond to that invitation.');
    }
  }

  return (
    <div className="tab-content">
      <h1>Work profiles</h1>
      <p className="lead">
        The organizations you belong to, and their public profiles. Organizations themselves are created by a
        tenant, not here — you join one via an invitation. Each organization you belong to gets its own section in
        the sidebar on the left.
      </p>

      {invites.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <h2>Pending invitations</h2>
          {actionError && <p className="error-text">{actionError}</p>}
          {invites.map((invite) => (
            <div key={invite.id} className="panel-card" style={{ marginBottom: 8 }}>
              <strong>{invite.role}</strong> — organization {invite.organizationId}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => respond(invite.id, true)}>Accept</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => respond(invite.id, false)}>Decline</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section style={{ marginTop: 20 }}>
        <h2>Your organizations</h2>
        {entries.length === 0 && <p className="lead">You&apos;re not a member of any organization yet.</p>}
        {entries.map(({ membership, profile }) => (
          <Link key={membership.organizationId} href={`/dashboard/work/${membership.organizationId}`} className="panel-card" style={{ display: 'block', marginBottom: 8, textDecoration: 'none' }}>
            <strong>{membership.organizationName}</strong>
            <p className="lead" style={{ margin: '4px 0 0' }}>
              {profile ? profile.displayName : 'No public profile yet — set one up →'}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
