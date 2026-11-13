import Link from 'next/link';

export default function TermsPage() {
  return (
    <main>
      <div className="card" style={{ textAlign: 'left', maxWidth: 520 }}>
        <p className="brand">NEWAX</p>
        <h1>Terms</h1>
        <p className="lead">
          This page is a placeholder for NEWAX&apos;s terms of service, covering use of your NEWAX
          ID and the apps connected to it.
        </p>
        <Link href="/" className="btn-link secondary">
          Back
        </Link>
      </div>
    </main>
  );
}
