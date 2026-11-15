import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main>
      <div className="card" style={{ textAlign: 'left', maxWidth: 640 }}>
        <p className="brand">NEWAX</p>
        <h1>Privacy Policy</h1>
        <p className="lead">
          Last updated: 2026-11-15. This policy describes what data NEWAX nID collects, why, and
          how you can control it.
        </p>

        <h2>1. What we collect</h2>
        <p>
          <strong>Account data.</strong> When you create an account we store your email address,
          a hashed password, and the date your account was created. If you enable phone-based
          verification we also store your phone number.
        </p>
        <p>
          <strong>Verification data.</strong> If you complete an identity verification flow we
          store the verification result (passed/failed), the method used (document scan, liveness
          check, OTP), and a timestamp. We do not store copies of uploaded documents after
          verification is complete unless required by law.
        </p>
        <p>
          <strong>Session data.</strong> We store session tokens to keep you logged in. Sessions
          expire after a configurable period of inactivity (default 60 minutes).
        </p>
        <p>
          <strong>Usage data.</strong> We collect server logs that include your IP address, user
          agent string, and the endpoints you access. These logs are retained for 90 days and used
          for security monitoring and debugging only.
        </p>

        <h2>2. Why we collect it</h2>
        <p>
          Account and session data are required to provide the identity service. Verification data
          is required to confirm your identity for connected apps. Usage logs are collected to
          detect and prevent abuse.
        </p>

        <h2>3. How long we keep it</h2>
        <p>
          Account data is kept until you delete your account. Verification results are kept for
          12 months after the last verification. Server logs are deleted after 90 days.
        </p>

        <h2>4. Who we share it with</h2>
        <p>
          We do not sell your data. Verification results may be shared with the connected app
          that requested the verification, in the form of a pass/fail status only — not the
          underlying document or biometric data. Third-party SDKs used in this product are listed
          below with their own privacy policies.
        </p>

        <h2>5. Third-party services</h2>
        <p>
          This product may use third-party document OCR and liveness-checking vendors. These
          vendors process the uploaded data on our behalf and are contractually prohibited from
          retaining or using it for their own purposes. The specific vendor is selected per
          region and may vary.
        </p>

        <h2>6. Your rights</h2>
        <p>
          <strong>Access.</strong> You can request a copy of the data we hold about you by
          contacting support@newax.com.
        </p>
        <p>
          <strong>Correction.</strong> You can update your account information from your account
          settings at any time.
        </p>
        <p>
          <strong>Deletion.</strong> You can request full account deletion from your account
          settings or by contacting support@newax.com. We will delete your data within 30 days
          of a verified deletion request, except where we are required to retain it by law.
        </p>
        <p>
          <strong>Portability.</strong> You can request your data in a machine-readable format.
        </p>

        <h2>7. Security</h2>
        <p>
          We use industry-standard encryption (TLS 1.2+) for data in transit and AES-256 for data
          at rest. Passwords are hashed using bcrypt. Access to your data by our team requires
          multi-factor authentication and is logged for audit purposes.
        </p>

        <h2>8. Children&apos;s data</h2>
        <p>
          This service is not intended for users under 16. We do not knowingly collect data from
          children under 16. If we learn we have collected such data, we will delete it promptly.
        </p>

        <h2>9. Contact</h2>
        <p>
          For questions about this policy or to exercise your rights, contact us at
          support@newax.com.
        </p>

        <Link href="/" className="btn-link secondary">
          Back
        </Link>
      </div>
    </main>
  );
}
