'use client';

import { useState } from 'react';
import { ApiError, sendContactMessage } from '../../lib/api';

export function ContactForm({ slug }: { slug: string }) {
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await sendContactMessage(slug, {
        senderName,
        senderPhone: senderPhone || undefined,
        senderEmail: senderEmail || undefined,
        message,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your message.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="section-card">
        <p className="success-text">Message sent — thanks for reaching out.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="senderName">Your name</label>
      <input id="senderName" type="text" required value={senderName} onChange={(e) => setSenderName(e.target.value)} />

      <label htmlFor="senderPhone">Phone (optional)</label>
      <input id="senderPhone" type="tel" value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} />

      <label htmlFor="senderEmail">Email (optional)</label>
      <input id="senderEmail" type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} />

      <label htmlFor="message">Message</label>
      <textarea id="message" required value={message} onChange={(e) => setMessage(e.target.value)} />

      <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={submitting}>
        {submitting ? 'Sending…' : 'Send message'}
      </button>

      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
