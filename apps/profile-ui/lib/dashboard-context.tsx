'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { OwnerProfile } from './owner-api';

export interface DashboardContextValue {
  token: string;
  profile: OwnerProfile;
  setProfile: (profile: OwnerProfile) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

/** Wraps every /dashboard/* route below the layout so each page can read the
 * session token and the already-fetched profile without re-fetching or
 * re-deriving them itself. */
export function DashboardProvider({ value, children }: { value: DashboardContextValue; children: ReactNode }) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

/** Throws when used outside app/dashboard/layout.tsx — every route under
 * app/dashboard/* is rendered inside that layout, so this should never fire
 * in practice; it's a guard against a page being moved out from under it. */
export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within app/dashboard/layout.tsx');
  }
  return ctx;
}
