import Link from 'next/link';

export default function TermsPage() {
  return (
    <main>
      <div className="card" style={{ textAlign: 'left', maxWidth: 640 }}>
        <p className="brand">NEWAX</p>
        <h1>Terms of Service</h1>
        <p className="lead">
          Last updated: 2026-11-15. By creating an account or using NEWAX nID, you agree to these
          terms.
        </p>

        <h2>1. Service description</h2>
        <p>
          NEWAX nID is an identity provider that authenticates users and verifies identities for
          connected applications. The service includes account management, multi-factor
          authentication, identity verification, and OAuth session management.
        </p>

        <h2>2. Account creation</h2>
        <p>
          You must be at least 16 years old to create an account. You are responsible for keeping
          your account credentials secure. You must notify us immediately if you suspect
          unauthorized access to your account.
        </p>

        <h2>3. Acceptable use</h2>
        <p>
          You may not use the service to: impersonate another person, submit fraudulent
          verification documents, attempt to bypass security controls, or use the service for any
          illegal purpose. We reserve the right to suspend or terminate accounts that violate
          these terms.
        </p>

        <h2>4. Verification accuracy</h2>
        <p>
          Identity verification results are provided as best-effort assessments. While we use
          industry-standard methods, verification is not a guarantee of identity. Connected apps
          should implement additional safeguards where appropriate.
        </p>

        <h2>5. Data processing</h2>
        <p>
          By using the service you consent to the collection and processing of your data as
          described in our Privacy Policy. We process your data to provide the identity service,
          prevent fraud, and comply with legal obligations.
        </p>

        <h2>6. Service availability</h2>
        <p>
          We aim for 99.9% uptime but do not guarantee uninterrupted service. Scheduled
          maintenance will be announced in advance where possible. We are not liable for
          interruptions caused by factors beyond our reasonable control.
        </p>

        <h2>7. Intellectual property</h2>
        <p>
          The service, including all code, design, and content, is owned by NEWAX and protected
          by copyright and trademark law. You may not copy, modify, or redistribute any part of
          the service without our written permission.
        </p>

        <h2>8. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, NEWAX is not liable for indirect, incidental,
          or consequential damages arising from your use of the service. Our total liability is
          limited to the amount you have paid us in the 12 months preceding the claim.
        </p>

        <h2>9. Termination</h2>
        <p>
          You may close your account at any time from your account settings. We may suspend or
          terminate your account if you violate these terms, with reasonable notice where
          practicable. Upon termination, your data will be handled as described in our Privacy
          Policy.
        </p>

        <h2>10. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. Material changes will be communicated via
          email or in-app notice at least 30 days before they take effect. Continued use of the
          service after changes take effect constitutes acceptance of the new terms.
        </p>

        <h2>11. Governing law</h2>
        <p>
          These terms are governed by the laws applicable to NEWAX&apos;s jurisdiction. Any
          disputes will be resolved in the courts of that jurisdiction.
        </p>

        <h2>12. Contact</h2>
        <p>
          For questions about these terms, contact us at support@newax.com.
        </p>

        <Link href="/" className="btn-link secondary">
          Back
        </Link>
      </div>
    </main>
  );
}
