import Link from 'next/link';
import { Logomark } from './components/logomark';

/**
 * Screen 1 (Welcome / entry) — redesigned to match Communicator's Login page
 * so the identity provider shares the same visual language: animated logo
 * circle, Fin Orange accent, sharp 4 px geometry, solid white card.
 */
export default function HomePage() {
  return (
    <main>
      <div className="card entry-card">
        {/* Logo & Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Logomark size={24} />
          </div>
          <p className="brand" style={{ margin: 0 }}>
            NEWAX
          </p>
        </div>

        {/* Headline */}
        <h1 className="entry-headline">Your work, connected.</h1>
        <p className="lead">One identity for your personal and business spaces.</p>

        {/* Action Buttons */}
        <div className="entry-actions">
          <Link href="/signin" className="btn-link">
            Sign in to Communicator
          </Link>
          <Link href="/create" className="btn-link secondary">
            Create a NEWAX ID
          </Link>
        </div>

        <p className="lead entry-sub">Secure access to the spaces you are authorized for.</p>

        <div className="entry-legal">
          <Link href="/privacy">Privacy</Link>
          <span aria-hidden="true">&middot;</span>
          <Link href="/security">Security</Link>
          <span aria-hidden="true">&middot;</span>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
    </main>
  );
}
