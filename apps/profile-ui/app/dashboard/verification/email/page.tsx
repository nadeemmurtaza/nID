'use client';

import { useDashboard } from '../../../../lib/dashboard-context';
import { EmailVerification } from '../../components/verification/EmailVerification';

export default function VerificationEmailPage() {
  const { token } = useDashboard();
  return <EmailVerification token={token} />;
}
