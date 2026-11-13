'use client';

import { useDashboard } from '../../../../lib/dashboard-context';
import { SelfServiceCheck } from '../../components/verification/SelfServiceCheck';

export default function VerificationIdentityPage() {
  const { token } = useDashboard();
  return (
    <SelfServiceCheck
      token={token}
      policyName="identity"
      title="Identity check"
      description="Upload a government ID and complete a live selfie capture to verify your identity."
    />
  );
}
