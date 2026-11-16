'use client';

import { useEffect, useState } from 'react';
import { getConsent, setConsent } from './consent';

/**
 * Cookie and storage notice. Accept and decline carry equal weight (no dark
 * pattern), the choice is stored through `consent.ts`, and optional scripts
 * are gated on it with `runWithConsent`. Shown only until the visitor has
 * chosen. `privacyHref` links to the privacy policy.
 */
export function ConsentBanner({ privacyHref }: { privacyHref?: string }) {
  const [visible, setVisible] = useState(false);

  // Read after mount: the choice lives in the browser, so the server render
  // and first client render must agree (nothing shown).
  useEffect(() => {
    setVisible(!getConsent().decided);
  }, []);

  if (!visible) return null;

  const choose = (accepted: boolean) => {
    setConsent({ analytics: accepted, marketing: accepted });
    setVisible(false);
  };

  return (
    <div className="nid-consent" role="region" aria-label="Storage and cookies">
      <div className="nid-consent-inner">
        <p>
          We keep you signed in with essential storage, which is always on. Optional analytics stays off unless you
          accept.{' '}
          {privacyHref ? <a href={privacyHref}>Read how we handle data</a> : null}
        </p>
        <div className="nid-consent-actions">
          <button type="button" onClick={() => choose(false)}>
            Decline
          </button>
          <button type="button" onClick={() => choose(true)}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
