import Link from 'next/link';

export default function SecurityPage() {
  return (
    <main>
      <div className="card" style={{ textAlign: 'left', maxWidth: 520 }}>
        <p className="brand">NEWAX</p>
        <h1>Security</h1>
        <p className="lead">
          This page is a placeholder. nID sign-in uses a one-time code sent to your phone or email
          &mdash; no password is required to exist. A successful sign-in establishes your identity
          and a session; it does not by itself grant access to any organization.
        </p>
        <Link href="/" className="btn-link secondary">
          Back
        </Link>
      </div>
    </main>
  );
}
