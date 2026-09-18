export default function HomePage() {
  return (
    <main className="center-page">
      <div className="card">
        <p className="brand" style={{ marginBottom: 18, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          nID Profiles
        </p>
        <h1>Your page lives at a URL</h1>
        <p className="lead" style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
          Every nID profile is published at its own address — nid.example/your-slug. There&apos;s nothing to browse
          from here.
        </p>
      </div>
    </main>
  );
}
