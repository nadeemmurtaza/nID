'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { MembershipInvite, Organization, OrgProfile } from './api';

export interface WorkEntry {
  organization: Organization;
  profile: OrgProfile | null;
}

export interface WorkContextValue {
  invites: MembershipInvite[];
  entries: WorkEntry[];
  reload: () => Promise<void>;
}

const WorkContext = createContext<WorkContextValue | null>(null);

/** Wraps every /dashboard/work/* route below app/dashboard/work/layout.tsx,
 * which fetches invites + organizations (and each organization's profile)
 * once and exposes them here -- so the overview page and each
 * [organizationId] page don't each re-fetch the same data. */
export function WorkProvider({ value, children }: { value: WorkContextValue; children: ReactNode }) {
  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
}

export function useWork(): WorkContextValue {
  const ctx = useContext(WorkContext);
  if (!ctx) {
    throw new Error('useWork must be used within app/dashboard/work/layout.tsx');
  }
  return ctx;
}
