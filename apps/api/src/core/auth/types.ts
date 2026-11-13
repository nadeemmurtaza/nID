export interface AuthenticatedTenant {
  tenantId: string;
  apiKeyId: string;
  scopes: string[];
}

/**
 * Who is actually making a staff-facing request — a tenant's own API key
 * (server-to-server), or a real human staff member's Account session
 * (TenantActorGuard resolves which via TenantStaffMembership). Narrower
 * than AuthenticatedTenant on purpose: only the handful of routes a human
 * in apps/dashboard actually calls (case list/read/resolve) need to know
 * WHICH KIND of actor this is, for an honest audit trail — every other
 * route stays exactly as ApiKeyGuard/AuthenticatedTenant already has it.
 */
export type ActorType = 'API_KEY' | 'TENANT_STAFF';

export interface AuthenticatedActor {
  tenantId: string;
  actorType: ActorType;
  actorId: string;
}

/**
 * Who is creating a VerificationCase — a tenant's own API key (the
 * original, still-primary path), or an Account creating a case against
 * itself through the self-service Verification Center. Kept separate
 * from AuthenticatedActor/ActorType above: those describe who's acting
 * for a TENANT (staff vs. API key), this describes who's acting for the
 * CASE CREATION call specifically, and an Account is never a tenant actor.
 */
export type CaseCreationActor = { type: 'API_KEY'; id: string } | { type: 'ACCOUNT'; id: string };
