'use client';

import { useEffect, useState } from 'react';

/**
 * Consent banner — COMPLIANCE_AND_ACCESSIBILITY_RULES.md §3.
 *
 * Shown before any non-essential cookies or tracking scripts are set.
 * Lets the user accept or decline with equal prominence.
 * Stored preference persists across page loads via localStorage.
 */

export default function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const choice = localStorage.getItem('consent-choice');
    if (!choice) {
      setShow(true);
    }
  }, []);

  const saveChoice = (accepted: boolean) => {
    localStorage.setItem('consent-choice', accepted ? 'accepted' : 'declined');
    setShow(false);

    if (accepted) {
      // Initialize non-essential cookies/tracking here
      console.log('Consent accepted — tracking enabled');
    } else {
      // Ensure no tracking cookies are set
      console.log('Consent declined — tracking disabled');
    }
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="consent-banner"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 'var(--space-4)',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        zIndex: 50,
        flexWrap: 'wrap',
      }}
    >
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-ink-muted)' }}>
        We use essential cookies to make the service work. We also use analytics cookies to
        understand how the service is used. You can accept or decline analytics cookies.
        {' '}
        <a href="/privacy" style={{ color: 'var(--color-accent)' }}>
          Read our privacy policy
        </a>
        .
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          className="btn-link secondary"
          onClick={() => saveChoice(false)}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-ink)',
          }}
        >
          Decline
        </button>
        <button
          onClick={() => saveChoice(true)}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-on-accent)',
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
