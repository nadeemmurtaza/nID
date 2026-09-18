'use client';

import { useEffect, useState } from 'react';
import { ApiError, listMyContactMessages, markContactMessageRead, type OwnerContactMessage } from '../../../lib/owner-api';

export function MessagesPanel({ token }: { token: string }) {
  const [messages, setMessages] = useState<OwnerContactMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyContactMessages(token)
      .then(setMessages)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load messages.'));
  }, [token]);

  async function handleMarkRead(id: string): Promise<void> {
    const updated = await markContactMessageRead(token, id);
    setMessages((prev) => prev?.map((m) => (m.id === id ? updated : m)) ?? null);
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Messages
      </h2>
      {messages?.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No messages yet.</p>}
      {messages?.map((msg) => (
        <div className="section-card" key={msg.id} style={{ opacity: msg.readAt ? 0.7 : 1 }}>
          <h3>
            {msg.senderName} {!msg.readAt && <span className="status-pill PENDING">New</span>}
          </h3>
          <p>{msg.message}</p>
          <div className="meta-row">
            <span>
              {msg.senderPhone ?? ''} {msg.senderEmail ?? ''}
            </span>
            <span>{new Date(msg.createdAt).toLocaleString()}</span>
          </div>
          {!msg.readAt && (
            <button type="button" className="small-btn" style={{ marginTop: 8 }} onClick={() => handleMarkRead(msg.id)}>
              Mark read
            </button>
          )}
        </div>
      ))}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
