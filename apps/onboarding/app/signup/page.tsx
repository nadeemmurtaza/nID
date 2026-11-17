'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApiError, createPersonalProfile, loginAccount, profileDashboardUrl, registerAccount, setStoredAccountSession } from '../../lib/api';

/**
 * Signing up to nID IS creating your personal profile -- there's no
 * separate "create your profile" step afterward. This form collects the
 * URL slug alongside the account fields and, on submit, chains
 * register -> login -> create-profile -> hand off straight into
 * apps/profile-ui's real dashboard, already signed in (the personal
 * profile dashboard lives there, not in a page of its own here -- see
 * profileDashboardUrl). If profile creation itself fails (most commonly:
 * the account's identity isn't verified yet -- see
 * ProfilesService::require_verified_real_name), the account and session
 * still exist regardless; profile-ui's own dashboard shows its own
 * "create your page" step in that case, so nothing is silently dropped.
 */
export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registerAccount({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });

      const { sessionToken } = await loginAccount(email.trim(), password);
      setStoredAccountSession(sessionToken);

      try {
        await createPersonalProfile(sessionToken, { slug: slug.trim().toLowerCase(), displayName: name.trim() });
      } catch {
        // Account + session are real either way -- the dashboard explains
        // this failure (e.g. identity not verified yet) instead of this
        // page swallowing it or blocking the redirect.
      }

      window.location.href = profileDashboardUrl(sessionToken);
      return;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <div className="card">
        <p className="brand">NID</p>
        <h1>Create your account</h1>
        <p className="lead">One identity for your work and personal profiles.</p>

        <form onSubmit={submit}>
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            autoFocus
            required
          />

          <label htmlFor="slug">Your URL</label>
          <input
            id="slug"
            type="text"
            placeholder="your-name"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            disabled={submitting}
            required
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
          />

          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+1 555 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={submitting}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
          />

          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="lead" style={{ marginTop: 20 }}>
          Already have an account? <Link href="/signin">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
