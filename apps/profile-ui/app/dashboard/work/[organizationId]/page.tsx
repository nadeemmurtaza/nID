'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApiError, createOrganizationProfile } from '../../../../lib/owner-api';
import { useDashboard } from '../../../../lib/dashboard-context';
import { useWork } from '../../../../lib/work-context';

export default function WorkOrganizationPage({ params }: { params: { organizationId: string } }) {
  const { token } = useDashboard();
  const { entries, reload } = useWork();
  const entry = entries.find((e) => e.membership.organizationId === params.organizationId);

  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState(entry?.membership.organizationName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!entry) {
    return <p className="lead">That organization isn&apos;t one you&apos;re a member of.</p>;
  }

  const { membership, profile } = entry;

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createOrganizationProfile(token, membership.organizationId, { slug: slug.trim().toLowerCase(), displayName: displayName.trim() });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create this organization's profile.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tab-content">
      <h1>{membership.organizationName}</h1>

      {profile ? (
        <div className="panel-card">
          <strong>{profile.displayName}</strong>
          {profile.headline && <p className="lead">{profile.headline}</p>}
          <span className={`verify-tag ${profile.isPublished ? 'verified' : 'unverified'}`}>{profile.isPublished ? 'Published' : 'Draft'}</span>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/dashboard/work/${membership.organizationId}/services`} className="btn btn-sm btn-secondary">
              Manage services
            </Link>
            <Link href={`/dashboard/work/${membership.organizationId}/availability`} className="btn btn-sm btn-secondary">
              Bookable hours
            </Link>
            <Link href={`/dashboard/work/${membership.organizationId}/appointments`} className="btn btn-sm btn-secondary">
              Appointments
            </Link>
            <Link href={`/dashboard/work/${membership.organizationId}/offers`} className="btn btn-sm btn-secondary">
              Offers
            </Link>
            <Link href={`/dashboard/work/${membership.organizationId}/hours`} className="btn btn-sm btn-secondary">
              Display hours
            </Link>
            <Link href={`/dashboard/work/${membership.organizationId}/links`} className="btn btn-sm btn-secondary">
              Links
            </Link>
            <Link href={`/dashboard/work/${membership.organizationId}/photos`} className="btn btn-sm btn-secondary">
              Photos
            </Link>
            <Link href={`/dashboard/work/${membership.organizationId}/messages`} className="btn btn-sm btn-secondary">
              Messages
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="lead">No public profile set up for this organization yet.</p>
          <form onSubmit={submit}>
            <input type="text" placeholder="Public URL" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} disabled={submitting} required />
            <input type="text" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={submitting} style={{ marginTop: 8 }} required />
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create work profile'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
