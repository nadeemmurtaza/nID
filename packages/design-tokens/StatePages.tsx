'use client';

import type { ReactNode } from 'react';
import { AlertIcon } from './icons';

/** Inline failure with a way forward. Use wherever a fetch can fail. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="nid-state" role="alert">
      <AlertIcon aria-hidden="true" />
      <p>{message}</p>
      {onRetry && <button type="button" className="secondary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/** Empty list that says what to do next, not just "nothing here". */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="nid-state nid-state-empty">
      <p className="nid-state-title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** App-level 404 body. Wrap in a page: export default () => <NotFoundPage home="/" />. */
export function NotFoundPage({ home = '/', product = 'nID' }: { home?: string; product?: string }) {
  return (
    <main className="nid-page-state">
      <h1>That page does not exist</h1>
      <p>The link may be old, or the address mistyped. Nothing was lost.</p>
      <a className="nid-link-button" href={home}>Back to {product}</a>
    </main>
  );
}

/** App-level error boundary body. Used by each app's error.tsx. */
export function ErrorPage({ error, reset, home = '/' }: { error: Error & { digest?: string }; reset: () => void; home?: string }) {
  return (
    <main className="nid-page-state" role="alert">
      <h1>Something went wrong on our side</h1>
      <p>
        Your data is safe. Try again, and if it keeps happening quote this code to support:
        {' '}<code>{error.digest ?? 'none'}</code>
      </p>
      <div className="nid-page-state-actions">
        <button type="button" onClick={reset}>Try again</button>
        <a className="nid-link-button secondary" href={home}>Go to start</a>
      </div>
    </main>
  );
}
