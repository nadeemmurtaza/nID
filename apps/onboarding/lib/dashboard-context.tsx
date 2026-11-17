'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Account } from './api';

export interface DashboardContextValue {
  token: string;
  account: Account;
  setAccount: (account: Account) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

/** Wraps every /dashboard/* route below the layout so each page can read the
 * session token and the already-fetched account without re-fetching it
 * itself -- mirrors apps/profile-ui's lib/dashboard-context.tsx. */
export function DashboardProvider({ value, children }: { value: DashboardContextValue; children: ReactNode }) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

/** Throws when used outside app/dashboard/layout.tsx -- every route under
 * app/dashboard/* is rendered inside that layout, so this should never fire
 * in practice; it's a guard against a page being moved out from under it. */
export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within app/dashboard/layout.tsx');
  }
  return ctx;
}
