'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { MembershipInvite, OrganizationMembership, OrgProfile } from './owner-api';

export interface WorkEntry {
  membership: OrganizationMembership;
  profile: OrgProfile | null;
}

export interface WorkContextValue {
  invites: MembershipInvite[];
  entries: WorkEntry[];
  reload: () => Promise<void>;
}

const WorkContext = createContext<WorkContextValue | null>(null);

/** Wraps every /dashboard/work/* route below app/dashboard/work/layout.tsx,
 * which fetches invites + organization memberships (and each org's public
 * profile) once and exposes them here -- so the sidebar and the overview/
 * per-organization pages all read the same data instead of each
 * re-fetching it separately. */
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
