'use client';

import { useEffect, useState } from 'react';
import {
  ApiError,
  listMyContactMessages,
  listOrgContactMessages,
  markContactMessageRead,
  markOrgContactMessageRead,
  type OwnerContactMessage,
} from '../../../lib/owner-api';

/** organizationId present -> this organization's work profile; absent ->
 * the caller's own personal profile -- see ServicesManager.tsx's doc
 * comment for the pattern this mirrors. */
export function MessagesPanel({ token, organizationId }: { token: string; organizationId?: string }) {
  const [messages, setMessages] = useState<OwnerContactMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function list() {
    return organizationId ? listOrgContactMessages(token, organizationId) : listMyContactMessages(token);
  }
  function markRead(id: string) {
    return organizationId ? markOrgContactMessageRead(token, organizationId, id) : markContactMessageRead(token, id);
  }

  useEffect(() => {
    list()
      .then(setMessages)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load messages.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizationId]);

  async function handleMarkRead(id: string): Promise<void> {
    const updated = await markRead(id);
    setMessages((prev) => prev?.map((m) => (m.id === id ? updated : m)) ?? null);
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Messages
      </h2>
      {messages?.length === 0 && <p className="empty-state">No messages yet.</p>}
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
            <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: 8 }} onClick={() => handleMarkRead(msg.id)}>
              Mark read
            </button>
          )}
        </div>
      ))}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
