const STORAGE_KEY = 'nid_dashboard_credential';
const API_URL = process.env.NEXT_PUBLIC_NID_API_URL ?? 'http://localhost:4000';

/**
 * A "credential" here is a Bearer token that's either a tenant API key or a
 * real staff member's Account session token (from phone+OTP login) —
 * TenantActorGuard on the apps/api side accepts either, so this layer
 * never needs to know or care which kind it's holding. Storing it in
 * localStorage is the same choice apps/verify-ui and apps/profile-ui's
 * owner dashboard already make for their own session tokens — unlike a
 * subject-facing surface, this app's user already holds real staff-level
 * access, so there's nothing a browser-stored token exposes that the
 * signed-in person couldn't already do.
 */
export function getStoredCredential(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredCredential(credential: string): void {
  window.localStorage.setItem(STORAGE_KEY, credential);
}

export function clearStoredCredential(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, credential: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${credential}`,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
    throw new ApiError(message ?? `Request to ${path} failed with ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}

// ---- staff phone+OTP login (unauthenticated — no credential yet) ----

export interface StaffAccount {
  id: string;
  phone: string;
}

export async function startStaffOtp(phone: string): Promise<void> {
  const res = await fetch(`${API_URL}/v1/accounts/otp/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
    throw new ApiError(message ?? 'Could not send a code.', res.status);
  }
}

export async function verifyStaffOtp(phone: string, code: string): Promise<{ sessionToken: string; account: StaffAccount }> {
  const res = await fetch(`${API_URL}/v1/accounts/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
    throw new ApiError(message ?? 'That code did not work.', res.status);
  }
  return res.json() as Promise<{ sessionToken: string; account: StaffAccount }>;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  dataResidencyRegion: string;
  webhookUrl: string | null;
  createdAt: string;
  /** Which kind of credential this session actually authenticated with — see TenantActorGuard. */
  signedInAs: 'API_KEY' | 'TENANT_STAFF';
}

export interface Subject {
  id: string;
  type: 'PERSON' | 'ORGANIZATION';
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  phone: string | null;
}

export type CaseStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'NEEDS_REVIEW';
export type ClaimType = 'IDENTITY' | 'DATE_OF_BIRTH' | 'EDUCATION' | 'EMPLOYMENT';
export type VerificationLevel = 'SELF_ATTESTED' | 'DOCUMENT_VERIFIED' | 'REGISTRY_VERIFIED';

export interface VerificationCaseListItem {
  id: string;
  status: CaseStatus;
  claimType: ClaimType;
  level: VerificationLevel;
  createdAt: string;
  resolvedAt: string | null;
  subject: Subject;
}

export interface VerificationMethodAttempt {
  id: string;
  method: string;
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';
  providerKey: string;
  startedAt: string;
  completedAt: string | null;
}

export interface VerificationCaseDetail extends VerificationCaseListItem {
  policyId: string;
  temporalWorkflowId: string | null;
  decision: string | null;
  reviewerId: string | null;
  attempts: VerificationMethodAttempt[];
}

/** The manual-review queue's one action — see apps/api's resolveCase(). */
export function resolveCase(
  credential: string,
  caseId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string,
): Promise<VerificationCaseDetail> {
  return apiFetch<VerificationCaseDetail>(`/v1/verification-cases/${caseId}/resolve`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision, reason }),
  });
}

/** One entry per ClaimType a Subject has ever passed a case for — see apps/api's badges endpoint. */
export interface SubjectBadge {
  claimType: ClaimType;
  level: VerificationLevel;
  verifiedAt: string | null;
  caseId: string | null;
}

export interface SubjectBadges {
  subjectId: string;
  badges: SubjectBadge[];
}

// ---- Tenant management (platform-admin and tenant-admin) ----

const PLATFORM_ADMIN_KEY = 'nid_platform_admin_secret';

export function getPlatformAdminSecret(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(PLATFORM_ADMIN_KEY);
}

export function setPlatformAdminSecret(secret: string): void {
  window.localStorage.setItem(PLATFORM_ADMIN_KEY, secret);
}

export function clearPlatformAdminSecret(): void {
  window.localStorage.removeItem(PLATFORM_ADMIN_KEY);
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  dataResidencyRegion?: string;
  webhookUrl?: string;
  billingWebhookUrl?: string;
  initialStaffAccountId?: string;
}

export interface CreateTenantResponse {
  id: string;
  name: string;
  slug: string;
  dataResidencyRegion: string;
  webhookUrl: string | null;
  webhookSecret: string;
  billingWebhookUrl: string | null;
  billingWebhookSecret: string;
  createdAt: string;
  message: string;
}

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  dataResidencyRegion: string;
  webhookUrl: string | null;
  billingWebhookUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    apiKeys: number;
    staff: number;
    organizations: number;
    subjects: number;
    cases: number;
  };
}

export type TenantDetail = TenantListItem;

export interface UpdateTenantRequest {
  name?: string;
  dataResidencyRegion?: string;
  webhookUrl?: string | null;
  webhookSecretPlaintext?: string | null;
  billingWebhookUrl?: string | null;
  billingWebhookSecretPlaintext?: string | null;
}

export interface TenantApiKey {
  id: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitPerMinute: number;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyResponse {
  prefix: string;
  plaintext: string;
  message: string;
}

export interface TenantStaffMember {
  id: string;
  accountId: string;
  role: string;
  phone: string | null;
  phoneVerified: boolean;
}

// Platform-admin API calls (uses platform admin secret, not tenant credential)

export async function platformApiFetch<T>(
  path: string,
  secret: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${secret}`,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
    throw new ApiError(message ?? `Request to ${path} failed with ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}

export function createTenant(secret: string, dto: CreateTenantRequest): Promise<CreateTenantResponse> {
  return platformApiFetch<CreateTenantResponse>('/v1/tenants', secret, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function listTenants(secret: string): Promise<TenantListItem[]> {
  return platformApiFetch<TenantListItem[]>('/v1/tenants', secret);
}

export function getTenantById(secret: string, id: string): Promise<TenantDetail> {
  return platformApiFetch<TenantDetail>(`/v1/tenants/${id}`, secret);
}

export function updateTenant(
  secret: string,
  id: string,
  dto: UpdateTenantRequest,
): Promise<TenantDetail> {
  return platformApiFetch<TenantDetail>(`/v1/tenants/${id}`, secret, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

// Tenant-admin API calls (uses tenant API key)

export function createApiKey(
  credential: string,
  tenantId: string,
  dto?: { keyPrefix?: string; scopes?: string[]; rateLimitPerMinute?: number },
): Promise<CreateApiKeyResponse> {
  return apiFetch<CreateApiKeyResponse>(`/v1/tenants/${tenantId}/api-keys`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto ?? {}),
  });
}

export function listApiKeys(credential: string, tenantId: string): Promise<TenantApiKey[]> {
  return apiFetch<TenantApiKey[]>(`/v1/tenants/${tenantId}/api-keys`, credential);
}

export function revokeApiKey(
  credential: string,
  tenantId: string,
  apiKeyId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/v1/tenants/${tenantId}/api-keys/${apiKeyId}`, credential, {
    method: 'DELETE',
  });
}

export function inviteStaff(
  credential: string,
  tenantId: string,
  accountId: string,
  role?: 'STAFF' | 'ADMIN',
): Promise<{ id: string; accountId: string; role: string; message: string }> {
  return apiFetch(`/v1/tenants/${tenantId}/staff`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accountId, role }),
  });
}

export function listStaff(credential: string, tenantId: string): Promise<TenantStaffMember[]> {
  return apiFetch<TenantStaffMember[]>(`/v1/tenants/${tenantId}/staff`, credential);
}

export function removeStaff(
  credential: string,
  tenantId: string,
  accountId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/v1/tenants/${tenantId}/staff/${accountId}`, credential, {
    method: 'DELETE',
  });
}

// ---- Organization management (tenant-admin) ----

export interface CreateOrganizationRequest {
  legalName: string;
  registrationNumber?: string;
  countryCode?: string;
}

export interface OrganizationRecord {
  id: string;
  tenantId: string;
  subjectId: string;
  legalName: string;
  registrationNumber: string | null;
  countryCode: string | null;
  createdAt: string;
  updatedAt: string;
  isVerified?: boolean;
  verifiedLevel?: string | null;
  verifiedCaseId?: string | null;
  verifiedAt?: string | null;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  personSubjectId: string;
  accountId: string | null;
  role: string;
  isAdmin: boolean;
  status: string;
  addedByApiKeyId: string | null;
  createdAt: string;
  respondedAt: string | null;
  phone?: string | null;
}

export interface InviteEmployeeRequest {
  phone: string;
  role: string;
  isAdmin?: boolean;
}

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  accountId: string;
  status: string;
  role: string;
  isAdmin: boolean;
  createdAt: string;
  organization: {
    id: string;
    legalName: string;
    countryCode: string | null;
  };
}

export function createOrganization(
  credential: string,
  dto: CreateOrganizationRequest,
): Promise<OrganizationRecord> {
  return apiFetch<OrganizationRecord>('/v1/organizations', credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function listOrganizations(credential: string): Promise<OrganizationRecord[]> {
  return apiFetch<OrganizationRecord[]>('/v1/organizations', credential);
}

export function getOrganization(
  credential: string,
  organizationId: string,
): Promise<OrganizationRecord> {
  return apiFetch<OrganizationRecord>(`/v1/organizations/${organizationId}`, credential);
}

export function listMembers(
  credential: string,
  organizationId: string,
): Promise<OrganizationMember[]> {
  return apiFetch<OrganizationMember[]>(`/v1/organizations/${organizationId}/members`, credential);
}

export function addMember(
  credential: string,
  organizationId: string,
  personSubjectId: string,
  role: string,
): Promise<OrganizationMember> {
  return apiFetch<OrganizationMember>(`/v1/organizations/${organizationId}/members`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ personSubjectId, role }),
  });
}

export function inviteEmployee(
  credential: string,
  organizationId: string,
  dto: InviteEmployeeRequest,
): Promise<OrganizationMember> {
  return apiFetch<OrganizationMember>(`/v1/organizations/${organizationId}/invite`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function listMyInvites(credential: string): Promise<OrganizationInvite[]> {
  return apiFetch<OrganizationInvite[]>('/v1/organizations/invites/mine', credential);
}

export function acceptInvite(
  credential: string,
  membershipId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/v1/organizations/invites/${membershipId}/accept`, credential, {
    method: 'POST',
  });
}

export function declineInvite(
  credential: string,
  membershipId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/v1/organizations/invites/${membershipId}/decline`, credential, {
    method: 'POST',
  });
}

// ---- Brand management ----

export interface BrandRecord {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  bio: string | null;
  logoKey: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  socialLinks: unknown | null;
  products: unknown | null;
  services: unknown | null;
  prices: unknown | null;
  policies: unknown | null;
  rules: unknown | null;
  toneGuidelines: string | null;
  keywords: unknown | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandRequest {
  organizationId: string;
  name: string;
  slug?: string;
  description?: string;
  bio?: string;
  website?: string;
  email?: string;
  phone?: string;
}

export interface UpdateBrandRequest {
  name?: string;
  slug?: string;
  description?: string;
  bio?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  primaryColor?: string;
  secondaryColor?: string;
  toneGuidelines?: string;
  active?: boolean;
}

export function createBrand(
  credential: string,
  dto: CreateBrandRequest,
): Promise<BrandRecord> {
  return apiFetch<BrandRecord>('/v1/brands', credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function listBrands(
  credential: string,
  organizationId: string,
): Promise<BrandRecord[]> {
  return apiFetch<BrandRecord[]>(`/v1/brands?organizationId=${encodeURIComponent(organizationId)}`, credential);
}

export function getBrand(
  credential: string,
  brandId: string,
): Promise<BrandRecord> {
  return apiFetch<BrandRecord>(`/v1/brands/${brandId}`, credential);
}

export function updateBrand(
  credential: string,
  brandId: string,
  dto: UpdateBrandRequest,
): Promise<BrandRecord> {
  return apiFetch<BrandRecord>(`/v1/brands/${brandId}`, credential, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function deactivateBrand(
  credential: string,
  brandId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/v1/brands/${brandId}`, credential, {
    method: 'DELETE',
  });
}

export interface BrandMembership {
  brandId: string;
  brandName: string;
  brandSlug: string;
  organizationId: string;
  organizationName: string;
  tenantId: string;
  tenantName: string;
  role: string;
}

export function listMyBrandMemberships(credential: string): Promise<BrandMembership[]> {
  return apiFetch<BrandMembership[]>('/v1/brands/my-memberships', credential);
}

// ---- Three-Layer Access Control System ----

// Layer 1: Access Grants (entity-level: tenant/org/brand)

export interface AccessGrantRecord {
  id: string;
  accountId: string;
  tenantId: string;
  organizationId: string | null;
  brandId: string | null;
  accessType: 'OWNER' | 'PARTNER' | 'ADMIN' | 'MEMBER';
  partnershipPercentage: number | null;
  grantedBy: string;
  status: 'ACTIVE' | 'REVOKED' | 'PENDING';
  createdAt: string;
  updatedAt: string;
  accountPhone: string | null;
  accountEmail: string | null;
}

export interface CreateAccessGrantRequest {
  accountId: string;
  organizationId?: string;
  brandId?: string;
  accessType: 'OWNER' | 'PARTNER' | 'ADMIN' | 'MEMBER';
  partnershipPercentage?: number;
}

export interface UpdateAccessGrantRequest {
  accessType?: 'OWNER' | 'PARTNER' | 'ADMIN' | 'MEMBER';
  partnershipPercentage?: number;
  status?: 'ACTIVE' | 'REVOKED' | 'PENDING';
}

export function createAccessGrant(
  credential: string,
  tenantId: string,
  dto: CreateAccessGrantRequest,
): Promise<AccessGrantRecord> {
  return apiFetch<AccessGrantRecord>(`/v1/access/${tenantId}/grant`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function listAccessGrants(
  credential: string,
  tenantId: string,
  organizationId?: string,
  brandId?: string,
): Promise<AccessGrantRecord[]> {
  const params = new URLSearchParams();
  if (organizationId) params.set('organizationId', organizationId);
  if (brandId) params.set('brandId', brandId);
  return apiFetch<AccessGrantRecord[]>(`/v1/access/${tenantId}/grants?${params}`, credential);
}

export function getAccessGrant(
  credential: string,
  tenantId: string,
  grantId: string,
): Promise<AccessGrantRecord> {
  return apiFetch<AccessGrantRecord>(`/v1/access/${tenantId}/grant/${grantId}`, credential);
}

export function updateAccessGrant(
  credential: string,
  tenantId: string,
  grantId: string,
  dto: UpdateAccessGrantRequest,
): Promise<AccessGrantRecord> {
  return apiFetch<AccessGrantRecord>(`/v1/access/${tenantId}/grant/${grantId}`, credential, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function revokeAccessGrant(
  credential: string,
  tenantId: string,
  grantId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/v1/access/${tenantId}/grant/${grantId}`, credential, {
    method: 'DELETE',
  });
}

export function transferOwnership(
  credential: string,
  tenantId: string,
  dto: { newOwnerId: string; organizationId?: string; brandId?: string },
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/v1/access/${tenantId}/transfer-ownership`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function addPartner(
  credential: string,
  tenantId: string,
  dto: { accountId: string; partnershipPercentage: number; organizationId?: string; brandId?: string },
): Promise<AccessGrantRecord> {
  return apiFetch<AccessGrantRecord>(`/v1/access/${tenantId}/partner`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function getMyPermissions(
  credential: string,
  tenantId: string,
  organizationId?: string,
  brandId?: string,
): Promise<string[]> {
  const params = new URLSearchParams();
  params.set('tenantId', tenantId);
  if (organizationId) params.set('organizationId', organizationId);
  if (brandId) params.set('brandId', brandId);
  return apiFetch<string[]>('/v1/access/my-permissions?' + params, credential);
}

// Layer 2: Departments

export interface DepartmentRecord {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  defaultPermissions: string[] | null;
  icon: string | null;
  color: string | null;
  inheritedFromTenant: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentRequest {
  name: string;
  slug?: string;
  defaultPermissions?: string[];
  icon?: string;
  color?: string;
}

export interface UpdateDepartmentRequest {
  name?: string;
  defaultPermissions?: string[];
  icon?: string;
  color?: string;
}

export interface DepartmentAssignmentRecord {
  id: string;
  accountId: string;
  departmentId: string;
  tenantId: string;
  organizationId: string | null;
  brandId: string | null;
  scope: 'TENANT' | 'ORGANIZATION' | 'BRAND';
  createdAt: string;
}

export function createDepartment(
  credential: string,
  tenantId: string,
  dto: CreateDepartmentRequest,
): Promise<DepartmentRecord> {
  return apiFetch<DepartmentRecord>(`/v1/departments/${tenantId}`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function listDepartments(
  credential: string,
  tenantId: string,
): Promise<DepartmentRecord[]> {
  return apiFetch<DepartmentRecord[]>(`/v1/departments/${tenantId}`, credential);
}

export function getDepartment(
  credential: string,
  tenantId: string,
  departmentId: string,
): Promise<DepartmentRecord> {
  return apiFetch<DepartmentRecord>(`/v1/departments/${tenantId}/${departmentId}`, credential);
}

export function updateDepartment(
  credential: string,
  tenantId: string,
  departmentId: string,
  dto: UpdateDepartmentRequest,
): Promise<DepartmentRecord> {
  return apiFetch<DepartmentRecord>(`/v1/departments/${tenantId}/${departmentId}`, credential, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function assignToDepartment(
  credential: string,
  tenantId: string,
  departmentId: string,
  dto: { accountId: string; organizationId?: string; brandId?: string; scope?: 'TENANT' | 'ORGANIZATION' | 'BRAND' },
): Promise<DepartmentAssignmentRecord> {
  return apiFetch<DepartmentAssignmentRecord>(`/v1/departments/${tenantId}/${departmentId}/assign`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function removeDepartmentAssignment(
  credential: string,
  tenantId: string,
  assignmentId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/v1/departments/${tenantId}/assignment/${assignmentId}`, credential, {
    method: 'DELETE',
  });
}

export function getAccountDepartments(
  credential: string,
  tenantId: string,
  accountId: string,
): Promise<DepartmentAssignmentRecord[]> {
  return apiFetch<DepartmentAssignmentRecord[]>(`/v1/departments/${tenantId}/account/${accountId}`, credential);
}

// Layer 3: Roles & Permissions

export interface RoleDefinitionRecord {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: string[];
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleRequest {
  name: string;
  slug?: string;
  description?: string;
  permissions: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface RoleAssignmentRecord {
  id: string;
  accountId: string;
  roleDefinitionId: string;
  tenantId: string;
  organizationId: string | null;
  brandId: string | null;
  scope: 'TENANT' | 'ORGANIZATION' | 'BRAND';
  createdAt: string;
}

export interface PermissionCatalogEntry {
  id: string;
  groupName: string;
  serviceName: string;
  permissionKey: string;
  label: string;
  description: string | null;
}

export interface PermissionCatalogGroup {
  groupName: string;
  services: {
    serviceName: string;
    permissions: PermissionCatalogEntry[];
  }[];
}

export function createRole(
  credential: string,
  tenantId: string,
  dto: CreateRoleRequest,
): Promise<RoleDefinitionRecord> {
  return apiFetch<RoleDefinitionRecord>(`/v1/roles/${tenantId}`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function listRoles(
  credential: string,
  tenantId: string,
): Promise<RoleDefinitionRecord[]> {
  return apiFetch<RoleDefinitionRecord[]>(`/v1/roles/${tenantId}`, credential);
}

export function getRole(
  credential: string,
  tenantId: string,
  roleId: string,
): Promise<RoleDefinitionRecord> {
  return apiFetch<RoleDefinitionRecord>(`/v1/roles/${tenantId}/${roleId}`, credential);
}

export function updateRole(
  credential: string,
  tenantId: string,
  roleId: string,
  dto: UpdateRoleRequest,
): Promise<RoleDefinitionRecord> {
  return apiFetch<RoleDefinitionRecord>(`/v1/roles/${tenantId}/${roleId}`, credential, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function deleteRole(
  credential: string,
  tenantId: string,
  roleId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/v1/roles/${tenantId}/${roleId}`, credential, {
    method: 'DELETE',
  });
}

export function assignRole(
  credential: string,
  tenantId: string,
  roleId: string,
  dto: { accountId: string; organizationId?: string; brandId?: string; scope?: 'TENANT' | 'ORGANIZATION' | 'BRAND' },
): Promise<RoleAssignmentRecord> {
  return apiFetch<RoleAssignmentRecord>(`/v1/roles/${tenantId}/${roleId}/assign`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function removeRoleAssignment(
  credential: string,
  tenantId: string,
  assignmentId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/v1/roles/${tenantId}/assignment/${assignmentId}`, credential, {
    method: 'DELETE',
  });
}

export function getAccountRoles(
  credential: string,
  tenantId: string,
  accountId: string,
): Promise<RoleAssignmentRecord[]> {
  return apiFetch<RoleAssignmentRecord[]>(`/v1/roles/${tenantId}/account/${accountId}`, credential);
}

export function getPermissionCatalog(
  credential: string,
): Promise<PermissionCatalogGroup[]> {
  return apiFetch<PermissionCatalogGroup[]>('/v1/permissions/catalog', credential);
}

export function getAllPermissions(
  credential: string,
): Promise<PermissionCatalogEntry[]> {
  return apiFetch<PermissionCatalogEntry[]>('/v1/permissions/all', credential);
}

export function getPermissionsByGroup(
  credential: string,
  groupName: string,
): Promise<PermissionCatalogEntry[]> {
  return apiFetch<PermissionCatalogEntry[]>(`/v1/permissions/group/${encodeURIComponent(groupName)}`, credential);
}

// Invitations

export interface InvitationRecord {
  id: string;
  tenantId: string;
  email: string | null;
  username: string | null;
  invitedBy: string;
  organizationId: string | null;
  brandId: string | null;
  scope: 'TENANT' | 'ORGANIZATION' | 'BRAND';
  roleDefinitionId: string | null;
  departmentId: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  createdAt: string;
}

export function sendEmailInvitation(
  credential: string,
  tenantId: string,
  dto: {
    email: string;
    organizationId?: string;
    brandId?: string;
    scope?: 'TENANT' | 'ORGANIZATION' | 'BRAND';
    roleDefinitionId?: string;
    departmentId?: string;
  },
): Promise<InvitationRecord> {
  return apiFetch<InvitationRecord>(`/v1/invitations/${tenantId}/email`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function sendUsernameInvitation(
  credential: string,
  tenantId: string,
  dto: {
    username: string;
    organizationId?: string;
    brandId?: string;
    scope?: 'TENANT' | 'ORGANIZATION' | 'BRAND';
    roleDefinitionId?: string;
    departmentId?: string;
  },
): Promise<InvitationRecord> {
  return apiFetch<InvitationRecord>(`/v1/invitations/${tenantId}/username`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export function acceptInvitation(
  credential: string,
  invitationId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/v1/invitations/${invitationId}/accept`, credential, {
    method: 'POST',
  });
}

export function listInvitations(
  credential: string,
  tenantId: string,
  status?: string,
): Promise<InvitationRecord[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  return apiFetch<InvitationRecord[]>(`/v1/invitations/${tenantId}?${params}`, credential);
}

export function revokeInvitation(
  credential: string,
  tenantId: string,
  invitationId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/v1/invitations/${tenantId}/${invitationId}`, credential, {
    method: 'DELETE',
  });
}
