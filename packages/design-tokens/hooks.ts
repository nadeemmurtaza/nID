'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Value that settles `delay` ms after the last change. For filter inputs and
 *  live validation, so typing never fires a request or a re-sort per key. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return settled;
}

/** Callback that runs at most once per `interval` ms (leading edge, plus one
 *  trailing call so the last event is never lost). For scroll, resize and
 *  repeat-click handlers. */
export function useThrottledCallback<A extends unknown[]>(fn: (...args: A) => void, interval = 300) {
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return useCallback((...args: A) => {
    const wait = interval - (Date.now() - last.current);
    if (wait <= 0) {
      last.current = Date.now();
      latest.current(...args);
    } else {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { last.current = Date.now(); latest.current(...args); }, wait);
    }
  }, [interval]);
}

export interface Hotkey {
  /** "mod+k" (Cmd on macOS, Ctrl elsewhere), "/", "?", or a sequence "g o". */
  keys: string;
  run: () => void;
  /** Fire even while a text field has focus. Default false. */
  inFields?: boolean;
}

function inEditable(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  // Checkboxes, radios and buttons do not take typed text, so shortcuts stay live.
  return el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|range|color|file)$/.test((el as HTMLInputElement).type);
}

/** Global keyboard shortcuts. Single keys and "g o" sequences are ignored
 *  while the user is typing in a field; "mod+..." combos always work. */
export function useHotkeys(hotkeys: Hotkey[]) {
  const ref = useRef(hotkeys);
  ref.current = hotkeys;
  useEffect(() => {
    let pending = '';
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const typing = inEditable(e.target);
      for (const h of ref.current) {
        if (h.keys.startsWith('mod+')) {
          if (mod && key === h.keys.slice(4)) { e.preventDefault(); h.run(); return; }
        }
      }
      if (mod || e.altKey || (typing && !ref.current.some((h) => h.inFields && h.keys === key))) return;
      const seq = pending ? `${pending} ${key}` : key;
      const exact = ref.current.find((h) => h.keys === seq);
      if (exact) { e.preventDefault(); pending = ''; h_clear(); exact.run(); return; }
      if (ref.current.some((h) => h.keys.startsWith(`${seq} `))) {
        pending = seq; h_clear(); timer = setTimeout(() => { pending = ''; }, 1200); return;
      }
      pending = '';
    };
    const h_clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); h_clear(); };
  }, []);
}
