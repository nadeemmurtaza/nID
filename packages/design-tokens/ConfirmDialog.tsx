'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Confirmation for destructive actions (SAAS_UX_PATTERNS.md item 19). Built
 * on the native <dialog>, so focus is trapped, Escape cancels and the page
 * behind is inert. Focus starts on Cancel: the safe choice is one keypress
 * away and the dangerous one never fires from a stray Enter.
 *
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   if (!(await confirm({ title: 'Revoke this key?', body: '...', confirmLabel: 'Revoke key' }))) return;
 *   ...
 *   return <>{dialog}...</>;
 */

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    cancelRef.current?.focus();
  }, []);

  return (
    <dialog ref={ref} className="nid-dialog" aria-labelledby="nid-dialog-title" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      <h2 id="nid-dialog-title">{title}</h2>
      <p>{body}</p>
      <div className="nid-dialog-actions">
        <button ref={cancelRef} type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className="nid-dialog-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

export function useConfirm(): { confirm: (o: ConfirmOptions) => Promise<boolean>; dialog: ReactNode } {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  );

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const dialog = pending ? (
    <ConfirmDialog {...pending.options} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
  ) : null;

  return { confirm, dialog };
}
