/**
 * Stops any form from submitting until every field passes. Mirrors the
 * server's rules (apps/rust-api/src/core/validation.rs) so the person sees
 * the problem next to the field instead of after a round trip; the server
 * still re-checks everything.
 *
 * One capture-phase listener on the document covers every <form> in the app,
 * including ones added later, so no form can be forgotten.
 */

const BAD = /[\u202A-\u202E\u2066-\u2069\u200B\uFEFF\u2028\u2029]/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const CONTROL_NO_NL = /[\u0000-\u001F\u007F]/;
const TAG = /<\s*\/?\s*[a-z!]/i;
const RE = {
  phone: /^\+[1-9][0-9]{6,14}$/,
  email: /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/,
  slug: /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/,
  username: /^@?[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/,
  cc: /^[A-Z]{2}$/,
  color: /^#[0-9A-Fa-f]{6}$/,
  otp: /^[0-9]{4,8}$/,
};
const MAX_FILE = 10 * 1024 * 1024;

const snake = (s: string) => s.replace(/([A-Z])/g, '_$1').replace(/[-\s]+/g, '_').toLowerCase();

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Returns an error message, or null when the field is fine. */
export function validateField(el: Field): string | null {
  if (el.disabled || (el as HTMLInputElement).type === 'hidden') return null;
  const type = (el as HTMLInputElement).type || '';
  const name = snake(el.getAttribute('name') || el.id || '');
  const auto = (el.getAttribute('autocomplete') || '').toLowerCase();

  if (type === 'file') {
    const files = Array.from((el as HTMLInputElement).files ?? []);
    if (el.required && files.length === 0) return 'Choose a file.';
    const accept = (el.getAttribute('accept') || '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
    for (const f of files) {
      if (f.size > MAX_FILE) return 'That file is larger than 10 MB.';
      if (accept.length && !accept.some((a) => (a.startsWith('.') ? f.name.toLowerCase().endsWith(a) : a.endsWith('/*') ? f.type.startsWith(a.slice(0, -1)) : f.type === a))) {
        return 'That file type is not allowed here.';
      }
    }
    return null;
  }
  if (type === 'checkbox' || type === 'radio') {
    if (type === 'checkbox' && el.required && !(el as HTMLInputElement).checked) return 'This box must be ticked to continue.';
    return null;
  }
  if (type === 'password') return null;

  const raw = el.value ?? '';
  const value = raw.trim();
  if (!value) return el.required ? 'Fill in this field.' : null;

  const isArea = el.tagName === 'TEXTAREA';
  if (BAD.test(raw) || (isArea ? CONTROL : CONTROL_NO_NL).test(raw)) {
    return 'Remove characters that are not allowed (control, zero-width or direction-override characters).';
  }
  const max = (el as HTMLInputElement).maxLength > 0 ? (el as HTMLInputElement).maxLength : isArea ? 5000 : 2000;
  if ([...raw].length > max) return `Use at most ${max} characters.`;
  const min = (el as HTMLInputElement).minLength;
  if (min > 0 && [...value].length < min) return `Use at least ${min} characters.`;

  if (type === 'number' || type === 'range') {
    const n = Number(value);
    if (!Number.isFinite(n) || Math.abs(n) > 1e12) return 'Enter a valid number.';
    const lo = el.getAttribute('min'), hi = el.getAttribute('max');
    if (lo !== null && n < Number(lo)) return `Must be at least ${lo}.`;
    if (hi !== null && n > Number(hi)) return `Must be at most ${hi}.`;
    return null;
  }

  const wantsPhone = type === 'tel' || auto === 'tel' || el.getAttribute('inputmode') === 'tel' || /(^|_)(phone|whatsapp)$/.test(name);
  const wantsEmail = type === 'email' || auto === 'email' || /(^|_)email$/.test(name);
  const wantsUrl = type === 'url' || /(^|_)(url|website|webhook_url|redirect_uri)$/.test(name);

  if (wantsPhone) {
    const stripped = value.replace(/[\s().-]/g, '');
    if (!RE.phone.test(stripped)) return 'Use international format with the country code, like +14155550123.';
  } else if (wantsEmail) {
    if (value.length > 254 || !RE.email.test(value)) return 'Enter an email address like name@example.com.';
  } else if (wantsUrl) {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'The address must start with https://';
      if (u.username || u.password) return 'The address must not contain a username or password.';
    } catch {
      return 'Enter a full address, like https://example.com.';
    }
  } else if (/(^|_)slug$/.test(name)) {
    if (!RE.slug.test(value)) return 'Use lowercase letters, numbers and single hyphens, like acme-pay.';
  } else if (name === 'username') {
    if (!RE.username.test(value)) return 'Use 2 to 64 letters, numbers, dots, dashes or underscores.';
  } else if (name === 'country_code') {
    if (!RE.cc.test(value)) return 'Use a two-letter uppercase country code, like US.';
  } else if (/(^|_)color$/.test(name)) {
    if (!RE.color.test(value)) return 'Use a hex colour like #1a2b3c.';
  } else if (auto === 'one-time-code' || (name === 'code' && el.getAttribute('inputmode') === 'numeric')) {
    if (!RE.otp.test(value)) return 'Enter the 4 to 8 digit code you received.';
  } else if (!isArea && TAG.test(value)) {
    return 'Remove HTML tags from this field.';
  }

  const pattern = el.getAttribute('pattern');
  if (pattern) {
    try {
      if (!new RegExp(`^(?:${pattern})$`, 'u').test(value)) return el.getAttribute('title') || 'This does not match the expected format.';
    } catch { /* an unusable pattern is the developer's problem, not the user's */ }
  }
  return null;
}

const MSG_ATTR = 'data-nid-guard-msg';

function showError(el: Field, message: string) {
  clearError(el);
  const p = document.createElement('p');
  p.className = 'nid-field-error';
  p.setAttribute('role', 'alert');
  p.setAttribute(MSG_ATTR, '1');
  p.id = `${el.id || 'f'}-guard-${Math.random().toString(36).slice(2, 7)}`;
  p.textContent = message;
  el.insertAdjacentElement('afterend', p);
  el.setAttribute('aria-invalid', 'true');
  const prev = el.getAttribute('aria-describedby');
  el.setAttribute('aria-describedby', prev ? `${prev} ${p.id}` : p.id);
}

function clearError(el: Field) {
  const next = el.nextElementSibling;
  if (next && next.hasAttribute(MSG_ATTR)) {
    const id = next.id;
    next.remove();
    el.removeAttribute('aria-invalid');
    const d = (el.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && x !== id).join(' ');
    d ? el.setAttribute('aria-describedby', d) : el.removeAttribute('aria-describedby');
  }
}

/** Validate every control in a form or field group. Returns the first invalid one. */
export function validateForm(form: HTMLFormElement | HTMLElement): Field | null {
  let first: Field | null = null;
  const all = form instanceof HTMLFormElement ? Array.from(form.elements) : Array.from(form.querySelectorAll('input, textarea, select'));
  const controls = all.filter((e): e is Field => /^(INPUT|TEXTAREA|SELECT)$/.test((e as HTMLElement).tagName));
  for (const el of controls) {
    const msg = validateField(el);
    // A component that already renders its own message for this field keeps it.
    const own = (el.getAttribute('aria-describedby') || '').includes('-err');
    if (msg && !own) {
      showError(el, msg);
      first ??= el;
    } else if (!msg) {
      clearError(el);
    }
  }
  return first;
}

// Buttons that leave or discard rather than send never need valid fields.
const NON_SENDING = /cancel|close|back|dismiss|sign out|log out|logout|delete|remove|revoke|reset|clear|discard|deactivate|decline|accept|edit|expand|collapse|show|hide|toggle/i;

let installed = false;

/** Install once per page. Safe to call repeatedly. */
export function installFormGuard(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener(
    'submit',
    (e) => {
      const form = e.target as HTMLFormElement;
      if (!(form instanceof HTMLFormElement) || form.hasAttribute('data-no-guard')) return;
      const bad = validateForm(form);
      if (bad) {
        e.preventDefault();
        e.stopImmediatePropagation();
        bad.focus();
      }
    },
    true,
  );
  // Buttons that send data without a <form> (save-on-click rows, decision
  // buttons): validate the nearest group of fields around the button.
  document.addEventListener(
    'click',
    (e) => {
      const btn = (e.target as Element | null)?.closest?.('button');
      if (!btn || btn.form || btn.disabled || btn.hasAttribute('data-no-guard') || btn.closest('dialog, [role="dialog"]')) return;
      if (NON_SENDING.test(`${btn.textContent ?? ''} ${btn.getAttribute('aria-label') ?? ''}`)) return;
      let scope: HTMLElement | null = btn.parentElement;
      while (scope && scope !== document.body && !scope.querySelector('input:not([type=hidden]), textarea, select')) scope = scope.parentElement;
      if (!scope || scope === document.body || scope.tagName === 'MAIN') return;
      const bad = validateForm(scope);
      if (bad) {
        e.preventDefault();
        e.stopImmediatePropagation();
        bad.focus();
      }
    },
    true,
  );
  // A chosen file is checked straight away, before anything uploads it.
  document.addEventListener(
    'change',
    (e) => {
      const el = e.target as HTMLInputElement;
      if (el?.type !== 'file') return;
      const msg = validateField(el);
      if (msg) {
        e.stopImmediatePropagation();
        el.value = '';
        showError(el, msg);
      } else {
        clearError(el);
      }
    },
    true,
  );
  // Once a field has been flagged, re-check it as the person fixes it.
  document.addEventListener('input', (e) => {
    const el = e.target as Field;
    if (el && el.nextElementSibling?.hasAttribute?.(MSG_ATTR)) {
      const msg = validateField(el);
      msg ? showError(el, msg) : clearError(el);
    }
  });
}
