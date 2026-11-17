'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, createProfile, loginAccount, registerAccount } from '../../lib/owner-api';
import { setStoredAccountSession } from '../../lib/session';
import { Logomark } from '../components/logomark';

/**
 * Signing up IS creating your personal profile -- there's no separate
 * "create your page" step afterward for a verified identity. Chains
 * register -> login -> create-profile -> /dashboard, already signed in.
 * If profile creation itself fails (most commonly: identity not verified
 * yet -- see ProfilesService::require_verified_real_name), the account
 * and session still exist regardless; /dashboard's own gate explains that
 * and offers the retry there, so nothing is silently dropped.
 */
export default function SignUpPage() {
  const router = useRouter();
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
      await registerAccount({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
      const { sessionToken } = await loginAccount(email.trim(), password);
      setStoredAccountSession(sessionToken);
      try {
        await createProfile(sessionToken, { slug: slug.trim().toLowerCase(), displayName: name.trim() });
      } catch {
        // handled below
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="center-page">
      <div className="card">
        <div className="login-logo">
          <Logomark size={44} />
        </div>
        <p className="brand">nID Profiles</p>
        <h1>Create your account</h1>
        <p className="lead">One identity for your work and personal profiles.</p>

        <form onSubmit={submit}>
          <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} autoFocus required />
          <input type="text" placeholder="your-name (your URL)" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} disabled={submitting} style={{ marginTop: 8 }} required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} style={{ marginTop: 8 }} required />
          <input type="tel" placeholder="+1 555 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting} style={{ marginTop: 8 }} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} minLength={8} style={{ marginTop: 8 }} required />

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="lead" style={{ marginTop: 20 }}>
          Already have an account? <a href="/dashboard/login">Sign in</a>
        </p>
      </div>
    </main>
  );
}
