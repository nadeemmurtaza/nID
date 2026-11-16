/**
 * Consent store (COMPLIANCE_AND_ACCESSIBILITY_RULES.md, consent banner).
 *
 * Essential storage (the session that keeps someone signed in) needs no
 * consent and is not represented here. Anything optional, such as analytics
 * or marketing scripts, must be started through `runWithConsent` so it cannot
 * run before the visitor agrees, and stops being started once they decline.
 * Nothing optional ships today; this is the gate for when it does.
 */

export type ConsentCategory = 'analytics' | 'marketing';

export interface ConsentState {
  /** Bump when the categories or their meaning change, to ask again. */
  version: number;
  /** False until the visitor has chosen. */
  decided: boolean;
  categories: Record<ConsentCategory, boolean>;
  decidedAt?: string;
}

const KEY = 'nid-consent';
const EVENT = 'nid-consent-change';
export const CONSENT_VERSION = 1;

const none = (): ConsentState => ({
  version: CONSENT_VERSION,
  decided: false,
  categories: { analytics: false, marketing: false },
});

export function getConsent(): ConsentState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return none();
    const parsed = JSON.parse(raw) as ConsentState;
    // A choice made under an older version no longer counts.
    return parsed.version === CONSENT_VERSION ? parsed : none();
  } catch {
    return none();
  }
}

export function setConsent(categories: Partial<Record<ConsentCategory, boolean>>): ConsentState {
  const next: ConsentState = {
    version: CONSENT_VERSION,
    decided: true,
    categories: { ...none().categories, ...categories },
    decidedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the choice holds for this page view only.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  return next;
}

export function hasConsent(category: ConsentCategory): boolean {
  return getConsent().categories[category] === true;
}

/**
 * Run `start` once consent for `category` is (or becomes) granted. Returns a
 * function that cancels waiting and calls any cleanup `start` returned.
 * Without consent `start` is never called.
 */
export function runWithConsent(category: ConsentCategory, start: () => void | (() => void)): () => void {
  let stop: void | (() => void);
  let started = false;
  const maybeStart = () => {
    if (!started && hasConsent(category)) {
      started = true;
      stop = start();
    }
  };
  const onChange = () => {
    if (started && !hasConsent(category)) {
      started = false;
      if (typeof stop === 'function') stop();
      stop = undefined;
    }
    maybeStart();
  };
  window.addEventListener(EVENT, onChange);
  maybeStart();
  return () => {
    window.removeEventListener(EVENT, onChange);
    if (started && typeof stop === 'function') stop();
  };
}
