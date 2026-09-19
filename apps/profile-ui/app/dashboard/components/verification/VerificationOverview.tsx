'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '../../../../lib/api';
import { getVerificationStatus, type AccountVerificationStatus } from '../../../../lib/owner-api';

interface Props {
  token: string;
}

function badgeLabel(claimType: string): string {
  switch (claimType) {
    case 'IDENTITY':
      return 'Identity';
    case 'DATE_OF_BIRTH':
      return 'Date of birth';
    case 'EDUCATION':
      return 'Education';
    case 'EMPLOYMENT':
      return 'Employment';
    default:
      return claimType;
  }
}

export function VerificationOverview({ token }: Props) {
  const [status, setStatus] = useState<AccountVerificationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVerificationStatus(token)
      .then(setStatus)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your verification status.'));
  }, [token]);

  if (error) return <p className="error-text">{error}</p>;
  if (!status) return <p style={{ color: 'var(--muted)' }}>Loading…</p>;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Your verification status
      </h2>

      <div className={`section-card${status.usernameEligible ? '' : ' attention'}`}>
        <div className="data-row">
          <span>
            <strong>Username eligibility</strong>
            <div className="meta">
              Requires a verified identity AND a phone confirmed linked to your own CNIC — a name alone is not enough.
            </div>
          </span>
          <span className={`verify-tag ${status.usernameEligible ? 'verified' : 'unverified'}`}>
            {status.usernameEligible ? '✓ Eligible' : '○ Not yet eligible'}
          </span>
        </div>
      </div>

      <h3 className="section-title">Identity badges</h3>
      {status.badges.length === 0 ? (
        <div className="empty-state">No verified badges yet. Start an identity check below.</div>
      ) : (
        <div className="section-card">
          {status.badges.map((badge) => (
            <div className="data-row" key={badge.claimType}>
              <span>{badgeLabel(badge.claimType)}</span>
              <span className="verify-tag verified">✓ {badge.level.replace('_', ' ').toLowerCase()}</span>
            </div>
          ))}
        </div>
      )}

      <h3 className="section-title">Real name</h3>
      <div className="section-card">
        {status.realName ? (
          <div className="data-row">
            <span>{status.realName.value}</span>
            <span className={`verify-tag ${status.realName.cnicPhoneLinked ? 'verified' : 'unverified'}`}>
              {status.realName.cnicPhoneLinked ? '✓ CNIC + phone linked' : '○ Not CNIC-linked'}
            </span>
          </div>
        ) : (
          <div className="empty-state">No verified name yet.</div>
        )}
      </div>

      <h3 className="section-title">CNIC + phone link — required, not optional</h3>
      <div className={`section-card${status.cnicPhoneLinked ? '' : ' attention'}`}>
        <div className="data-row">
          <span>
            A phone number confirmed to actually be registered under your own name via a national registry check.
          </span>
          <span className={`verify-tag ${status.cnicPhoneLinked ? 'verified' : 'unverified'}`}>
            {status.cnicPhoneLinked ? '✓ Confirmed' : '○ Not confirmed'}
          </span>
        </div>
        {!status.cnicPhoneLinked && (
          <Link href="/dashboard/verification/cnic-phone" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
            Start CNIC + phone check
          </Link>
        )}
      </div>

      <h3 className="section-title">Email</h3>
      <div className="section-card">
        <div className="data-row">
          <span>{status.email.address ?? 'No email on file'}</span>
          <span className={`verify-tag ${status.email.verifiedAt ? 'verified' : 'unverified'}`}>
            {status.email.verifiedAt ? '✓ Verified' : '○ Unverified'}
          </span>
        </div>
        {!status.email.verifiedAt && (
          <Link href="/dashboard/verification/email" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>
            Verify your email
          </Link>
        )}
      </div>
    </div>
  );
}
