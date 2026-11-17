'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useDebouncedValue } from './hooks';
import { useConfirm } from './ConfirmDialog';
import { ErrorState, EmptyState } from './StatePages';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Value to sort and filter by. Omit to make the column unsortable. */
  value?: (row: T) => string | number;
  numeric?: boolean;
}

export interface BulkAction<T> {
  label: string;
  run: (rows: T[]) => Promise<void> | void;
  /** Asks for confirmation first, naming how many rows are affected. */
  destructive?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[] | null;
  rowId: (row: T) => string;
  caption: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty: { title: string; hint?: string; action?: ReactNode };
  bulkActions?: BulkAction<T>[];
  /** Per-row trailing cell, e.g. a single revoke button. */
  rowActions?: (row: T) => ReactNode;
  filterLabel?: string;
}

/** Shared table: sortable headers (aria-sort), debounced filter, row selection
 *  with a bulk action bar, skeleton while loading, retry on error, and a
 *  helpful empty state. One component so every list behaves the same. */
export function DataTable<T>({ columns, rows, rowId, caption, loading, error, onRetry, empty, bulkActions, rowActions, filterLabel = 'Filter' }: Props<T>) {
  const [filter, setFilter] = useState('');
  const q = useDebouncedValue(filter, 200).trim().toLowerCase();
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();

  const view = useMemo(() => {
    let out = rows ?? [];
    if (q) out = out.filter((r) => columns.some((c) => c.value && String(c.value(r)).toLowerCase().includes(q)));
    const col = sort && columns.find((c) => c.key === sort.key);
    if (sort && col?.value) {
      const val = col.value;
      out = [...out].sort((a, b) => {
        const x = val(a), y = val(b);
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
    }
    return out;
  }, [rows, q, sort, columns]);

  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading || rows === null) return <Skeleton count={5} height={36} />;
  if (rows.length === 0) return <EmptyState title={empty.title} action={empty.action}>{empty.hint}</EmptyState>;

  const selectable = !!bulkActions?.length;
  const visibleIds = view.map(rowId);
  const chosen = view.filter((r) => picked.has(rowId(r)));
  const allOn = visibleIds.length > 0 && visibleIds.every((id) => picked.has(id));
  const toggleAll = () => setPicked(allOn ? new Set() : new Set(visibleIds));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const runBulk = async (a: BulkAction<T>) => {
    if (a.destructive && !(await confirm({
      title: `${a.label} ${chosen.length} ${chosen.length === 1 ? 'item' : 'items'}?`,
      body: 'This cannot be undone.',
      confirmLabel: `${a.label} ${chosen.length}`,
    }))) return;
    setBusy(true);
    try { await a.run(chosen); setPicked(new Set()); } finally { setBusy(false); }
  };

  const clickSort = (c: Column<T>) => {
    if (!c.value) return;
    setSort((s) => (s?.key !== c.key ? { key: c.key, dir: 1 } : s.dir === 1 ? { key: c.key, dir: -1 } : null));
  };

  return (
    <div className="nid-table">
      {dialog}
      <div className="nid-table-bar">
        <label className="nid-table-filter">
          <span>{filterLabel}</span>
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Type to narrow the list" />
        </label>
        {selectable && chosen.length > 0 && (
          <div className="nid-table-bulk" role="group" aria-label="Actions for selected rows">
            <span>{chosen.length} selected</span>
            {bulkActions!.map((a) => (
              <button key={a.label} type="button" disabled={busy} className={a.destructive ? 'nid-dialog-danger' : 'secondary'} onClick={() => runBulk(a)}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="nid-table-scroll">
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selectable && (
                <th className="nid-table-check"><input type="checkbox" aria-label="Select all rows" checked={allOn} onChange={toggleAll} /></th>
              )}
              {columns.map((c) => {
                const dir = sort?.key === c.key ? sort.dir : 0;
                return (
                  <th key={c.key} aria-sort={dir === 1 ? 'ascending' : dir === -1 ? 'descending' : c.value ? 'none' : undefined} className={c.numeric ? 'num' : undefined}>
                    {c.value ? (
                      <button type="button" className="nid-th-sort" onClick={() => clickSort(c)}>
                        {c.header}<span aria-hidden="true">{dir === 1 ? ' ↑' : dir === -1 ? ' ↓' : ''}</span>
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
              {rowActions && <th><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const id = rowId(r);
              return (
                <tr key={id} aria-selected={selectable ? picked.has(id) : undefined}>
                  {selectable && <td className="nid-table-check"><input type="checkbox" aria-label="Select row" checked={picked.has(id)} onChange={() => toggle(id)} /></td>}
                  {columns.map((c) => <td key={c.key} className={c.numeric ? 'num' : undefined}>{c.render(r)}</td>)}
                  {rowActions && <td>{rowActions(r)}</td>}
                </tr>
              );
            })}
            {view.length === 0 && <tr><td colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}>No rows match "{filter}".</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
