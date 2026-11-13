import Link from 'next/link';

export default function HelpPage() {
  return (
    <main>
      <div className="card" style={{ textAlign: 'left', maxWidth: 520 }}>
        <p className="brand">NEWAX</p>
        <h1>Help</h1>
        <p className="lead">
          nID is the sign-in used across NEWAX apps. If a &quot;Continue with nID&quot; button sent
          you here and something went wrong, try again from that app. For anything else, contact
          the team that invited you.
        </p>
        <Link href="/" className="btn-link secondary">
          Back
        </Link>
      </div>
    </main>
  );
}
