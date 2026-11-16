'use client';

import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';

/** Validators return an error message, or null when the value is fine. */
export type Validator = (value: string) => string | null;

export const v = {
  required: (what = 'This field'): Validator => (s) => (s.trim() ? null : `${what} is required.`),
  slug: (): Validator => (s) => (!s || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) ? null : 'Use lowercase letters, numbers and single hyphens, like acme-pay.'),
  url: (): Validator => (s) => {
    if (!s) return null;
    try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' ? null : 'Start with https://'; }
    catch { return 'Enter a full address, like https://example.com/hooks.'; }
  },
  email: (): Validator => (s) => (!s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? null : 'Enter an email address like name@example.com.'),
  phone: (): Validator => (s) => (!s || /^\+[1-9]\d{6,14}$/.test(s.replace(/[\s()-]/g, '')) ? null : 'Use international format, like +14155550123.'),
  minLength: (n: number): Validator => (s) => (!s || s.length >= n ? null : `Use at least ${n} characters.`),
  /** First failing validator wins. */
  all: (...vs: Validator[]): Validator => (s) => { for (const f of vs) { const m = f(s); if (m) return m; } return null; },
};

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  validate?: Validator;
  hint?: ReactNode;
  /** Set by a form after a failed submit so every error shows at once. */
  forceShow?: boolean;
}

/**
 * Labelled input with inline validation: the error appears when the user
 * leaves the field (never while they are still typing the first time), then
 * updates live as they fix it. The label is wired with htmlFor and the error
 * with aria-describedby, so screen readers get both.
 */
export function Field({ label, value, onChange, validate, hint, forceShow, id, ...rest }: FieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  const [touched, setTouched] = useState(false);
  const error = validate && (touched || forceShow) ? validate(value) : null;
  return (
    <div className={`nid-field${error ? ' has-error' : ''}`}>
      <label htmlFor={fid}>{label}</label>
      <input
        {...rest}
        id={fid}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => { setTouched(true); rest.onBlur?.(e); }}
      />
      {error ? <p id={`${fid}-err`} className="nid-field-error" role="alert">{error}</p>
        : hint ? <p id={`${fid}-hint`} className="nid-field-hint">{hint}</p> : null}
    </div>
  );
}

/** True when every [value, validator] pair passes. Use in onSubmit. */
export function allValid(pairs: Array<[string, Validator | undefined]>): boolean {
  return pairs.every(([val, fn]) => !fn || fn(val) === null);
}
