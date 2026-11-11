import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main>
      <div className="card" style={{ textAlign: 'left', maxWidth: 520 }}>
        <p className="brand">NEWAX</p>
        <h1>Privacy</h1>
        <p className="lead">
          This page is a placeholder. NEWAX&apos;s privacy policy will describe what account and
          verification data nID collects, how it is used across connected apps, and how to request
          its deletion.
        </p>
        <Link href="/" className="btn-link secondary">
          Back
        </Link>
      </div>
    </main>
  );
}
