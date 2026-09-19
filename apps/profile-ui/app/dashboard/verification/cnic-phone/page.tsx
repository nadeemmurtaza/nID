'use client';

import { useDashboard } from '../../../../lib/dashboard-context';
import { SelfServiceCheck } from '../../components/verification/SelfServiceCheck';

export default function VerificationCnicPhonePage() {
  const { token } = useDashboard();
  return (
    <SelfServiceCheck
      token={token}
      policyName="cnic-phone-link"
      title="CNIC + phone link"
      description="Required, not optional: confirms the phone number on your account is actually registered under your own name via a national e-stamp registry check — the specific bar username eligibility requires."
      requiresReferenceId
      referenceIdLabel="CNIC number"
    />
  );
}
