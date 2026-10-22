export default function ProfileNotFound() {
  return (
    <main className="center-page">
      <div className="card">
        <h1>Page not found</h1>
        <p className="lead" style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
          There&apos;s no published nID profile at this address.
        </p>
      </div>
    </main>
  );
}
