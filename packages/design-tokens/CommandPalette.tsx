'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue, useHotkeys } from './hooks';

/**
 * Command palette (SAAS_UX_PATTERNS.md: power users, keyboard shortcuts).
 * Opens on Cmd/Ctrl+K or "/", filters as you type, arrow keys move, Enter
 * runs, Escape closes. Built on the native <dialog> so focus is trapped and
 * the page behind is inert.
 */
export interface Command {
  id: string;
  label: string;
  /** Group heading, e.g. "Go to" or "Actions". */
  group?: string;
  /** Shortcut shown on the right, e.g. "g o". */
  shortcut?: string;
  run: () => void;
}

export function CommandPalette({ commands }: { commands: Command[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const q = useDebouncedValue(query, 80).trim().toLowerCase();

  useHotkeys([
    { keys: 'mod+k', run: () => setOpen(true) },
    { keys: '/', run: () => setOpen(true) },
    { keys: '?', run: () => setOpen(true) },
  ]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); input.current?.focus(); }
    if (!open && d.open) d.close();
  }, [open]);

  const shown = useMemo(
    () => (q ? commands.filter((c) => `${c.group ?? ''} ${c.label}`.toLowerCase().includes(q)) : commands),
    [commands, q],
  );
  useEffect(() => setActive(0), [q]);

  const close = () => { setOpen(false); setQuery(''); };
  const run = (c: Command) => { close(); c.run(); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && shown[active]) { e.preventDefault(); run(shown[active]); }
  };

  useEffect(() => {
    document.getElementById(`cmd-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  let lastGroup: string | undefined;
  return (
    <dialog
      ref={ref}
      className="nid-palette"
      aria-label="Command palette"
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === ref.current) close(); }}
    >
      {open && (
        <div onKeyDown={onKeyDown}>
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-list"
            aria-activedescendant={shown[active] ? `cmd-${active}` : undefined}
            className="nid-palette-input"
            placeholder="Type a command or page name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul id="cmd-list" role="listbox" className="nid-palette-list">
            {shown.length === 0 && <li className="nid-palette-empty">No command matches "{query}".</li>}
            {shown.map((c, i) => {
              const heading = c.group !== lastGroup ? c.group : undefined;
              lastGroup = c.group;
              return (
                <li key={c.id} role="presentation">
                  {heading && <div className="nid-palette-group">{heading}</div>}
                  <button
                    id={`cmd-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className="nid-palette-item"
                    onMouseMove={() => setActive(i)}
                    onClick={() => run(c)}
                  >
                    <span>{c.label}</span>
                    {c.shortcut && <kbd>{c.shortcut}</kbd>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="nid-palette-foot">Arrow keys to move, Enter to run, Esc to close.</p>
        </div>
      )}
    </dialog>
  );
}
