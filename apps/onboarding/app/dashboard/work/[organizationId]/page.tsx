'use client';

import { useState } from 'react';
import { ApiError, createOrganizationProfile } from '../../../../lib/api';
import { useDashboard } from '../../../../lib/dashboard-context';
import { useWork } from '../../../../lib/work-context';

export default function WorkOrganizationPage({ params }: { params: { organizationId: string } }) {
  const { token } = useDashboard();
  const { entries, reload } = useWork();
  const entry = entries.find((e) => e.organization.id === params.organizationId);

  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState(entry?.organization.legalName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!entry) {
    return <p className="lead">That organization isn&apos;t one you&apos;re a member of.</p>;
  }

  const { organization, profile } = entry;

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createOrganizationProfile(token, organization.id, { slug: slug.trim(), displayName: displayName.trim() });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create this organization's profile.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>{organization.legalName}</h1>

      {profile ? (
        <div className="account-chip">
          <span className="account-chip-label">{profile.slug}</span>
          <span className="account-chip-value">{profile.displayName}</span>
          {profile.headline && <span>{profile.headline}</span>}
          <span className={`badge ${profile.isPublished ? 'verified' : 'unverified'}`} style={{ marginTop: 6, width: 'fit-content' }}>
            {profile.isPublished ? 'Published' : 'Draft'}
          </span>
        </div>
      ) : (
        <>
          <p className="lead">No public profile set up for this organization yet.</p>
          <form onSubmit={submit}>
            <label htmlFor="org-slug">Public URL</label>
            <input id="org-slug" type="text" required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} disabled={submitting} />

            <label htmlFor="org-display-name">Display name</label>
            <input id="org-display-name" type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={submitting} />

            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create work profile'}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
