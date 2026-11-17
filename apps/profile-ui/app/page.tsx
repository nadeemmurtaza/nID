/**
 * This app's own sign-up/sign-in live here too now (see app/signup and
 * app/dashboard/login) -- before that merge, this page's only job was
 * explaining that there was nothing else to browse here, since every
 * profile is published at its own slug. Now it's the entry point into
 * that account system as well, so it offers both instead of dead-ending.
 */
export default function HomePage() {
  return (
    <main className="center-page">
      <div className="card">
        <p className="brand" style={{ marginBottom: 18, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          nID Profiles
        </p>
        <h1>Your page lives at a URL</h1>
        <p className="lead" style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
          Every nID profile is published at its own address, which is the slug its owner picked. There&apos;s nothing to
          browse from here — but you can create or manage yours.
        </p>
        <a href="/signup" className="btn btn-primary btn-block">
          Create an account
        </a>
        <a href="/dashboard/login" className="btn btn-secondary btn-block" style={{ marginTop: 8 }}>
          Sign in
        </a>
      </div>
    </main>
  );
}
