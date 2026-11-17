import { apiFetch, ApiError, type Badge } from './api';

const API_URL = process.env.NEXT_PUBLIC_NID_API_URL ?? 'http://localhost:4000';

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

/** Same contract as apiFetch, plus the Authorization header every /me/* and owner route requires. */
function authedFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, { ...init, headers: { ...authHeaders(token), ...(init?.headers ?? {}) } });
}

/** Multipart upload — deliberately does NOT set content-type, so the browser can add its own boundary. */
async function authedUpload<T>(path: string, token: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers: authHeaders(token), body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
    throw new ApiError(message ?? `Upload to ${path} failed with ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

export { ApiError };

// ---- account ----

export interface Account {
  id: string;
  phone: string;
  email: string | null;
  name?: string | null;
  phoneVerifiedAt: string | null;
  emailVerifiedAt?: string | null;
}

export function getMe(token: string): Promise<Account> {
  return authedFetch('/v1/accounts/me', token);
}

/** POST /v1/accounts/register — the detailed sign-up form (name/email/phone/password),
 * an alternative to the phone+OTP flow below. Unauthenticated: no token yet. */
export function registerAccount(input: { name: string; email: string; phone: string; password: string }): Promise<Account> {
  return apiFetch('/v1/accounts/register', { method: 'POST', body: JSON.stringify(input) });
}

/** POST /v1/accounts/login — email + password sign-in, the counterpart to registerAccount. */
export function loginAccount(email: string, password: string): Promise<{ sessionToken: string; account: Account }> {
  return apiFetch('/v1/accounts/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

/** Starts (or re-sends) a one-time sign-in/registration code for a phone number. */
export function startOtp(phone: string): Promise<void> {
  return apiFetch('/v1/accounts/otp/start', { method: 'POST', body: JSON.stringify({ phone }) });
}

/** Verifying the first-ever code for a phone number both creates the Account and signs it in. */
export function verifyOtp(phone: string, code: string): Promise<{ sessionToken: string; account: Account }> {
  return apiFetch('/v1/accounts/otp/verify', { method: 'POST', body: JSON.stringify({ phone, code }) });
}

/** DELETE /v1/accounts/me — erases the account and the data that belongs to it. */
export function deleteAccount(token: string): Promise<void> {
  return authedFetch('/v1/accounts/me', token, { method: 'DELETE' });
}

// ---- profile ----

export interface OwnerProfile {
  id: string;
  accountId: string;
  slug: string;
  displayName: string;
  headline: string | null;
  category: string;
  bio: string | null;
  photoKey: string | null;
  phone: string | null;
  whatsapp: string | null;
  publicEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  showPhone: boolean;
  showWhatsapp: boolean;
  showEmail: boolean;
  showAddress: boolean;
  showBadges: boolean;
  showBooking: boolean;
  showOffers: boolean;
  showHours: boolean;
  showRealName: boolean;
  isPublished: boolean;
}

export type ProfileInput = Partial<
  Omit<OwnerProfile, 'id' | 'accountId' | 'photoKey'> & { slug: string; displayName: string }
>;

export async function getMyProfile(token: string): Promise<OwnerProfile | null> {
  try {
    return await authedFetch<OwnerProfile>('/v1/profiles/me', token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function createProfile(token: string, input: ProfileInput): Promise<OwnerProfile> {
  return authedFetch('/v1/profiles', token, { method: 'POST', body: JSON.stringify(input) });
}

export function updateProfile(token: string, input: ProfileInput): Promise<OwnerProfile> {
  return authedFetch('/v1/profiles/me', token, { method: 'PATCH', body: JSON.stringify(input) });
}

export function uploadPhoto(token: string, file: File): Promise<OwnerProfile> {
  return authedUpload('/v1/profiles/me/photo', token, file);
}

// ---- field grants ----
// "Show only one specific info to only one person or organization by his
// own will" — a private, single-recipient exception to the show* toggles
// above, granted by the recipient's own nID username.

export type GrantField = 'PHONE' | 'WHATSAPP' | 'EMAIL' | 'ADDRESS' | 'REAL_NAME';

export interface OwnerFieldGrant {
  id: string;
  field: GrantField;
  granteeAccountId: string | null;
  granteeOrganizationId: string | null;
  createdAt: string;
}

export function listMyGrants(token: string): Promise<OwnerFieldGrant[]> {
  return authedFetch('/v1/profiles/me/grants', token);
}

export function createGrant(token: string, field: GrantField, granteeSlug: string): Promise<OwnerFieldGrant> {
  return authedFetch('/v1/profiles/me/grants', token, { method: 'POST', body: JSON.stringify({ field, granteeSlug }) });
}

export function revokeGrant(token: string, id: string): Promise<void> {
  return authedFetch(`/v1/profiles/me/grants/${id}`, token, { method: 'DELETE' });
}

// ---- services ----

export interface OwnerService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number | null;
  currency: string | null;
  isActive: boolean;
}

export type ServiceInput = Partial<Omit<OwnerService, 'id'>>;

export function listMyServices(token: string): Promise<OwnerService[]> {
  return authedFetch('/v1/profiles/me/services', token);
}

export function createService(token: string, input: ServiceInput): Promise<OwnerService> {
  return authedFetch('/v1/profiles/me/services', token, { method: 'POST', body: JSON.stringify(input) });
}

export function updateService(token: string, id: string, input: ServiceInput): Promise<OwnerService> {
  return authedFetch(`/v1/profiles/me/services/${id}`, token, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteService(token: string, id: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/profiles/me/services/${id}`, token, { method: 'DELETE' });
}

// ---- services (an organization's work profile) ----
// Same shape as the owner ones above, scoped to an organization's work
// profile instead of the caller's personal one -- see
// apps/rust-api/src/modules/booking's "Work endpoints".

export function listOrgServices(token: string, organizationId: string): Promise<OwnerService[]> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/services`, token);
}

export function createOrgService(token: string, organizationId: string, input: ServiceInput): Promise<OwnerService> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/services`, token, { method: 'POST', body: JSON.stringify(input) });
}

export function updateOrgService(token: string, organizationId: string, id: string, input: ServiceInput): Promise<OwnerService> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/services/${id}`, token, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteOrgService(token: string, organizationId: string, id: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/services/${id}`, token, { method: 'DELETE' });
}

// ---- availability rules ----

export interface OwnerAvailabilityRule {
  id: string;
  day: string;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
}

export interface AvailabilityRuleInput {
  day: string;
  startMinute: number;
  endMinute: number;
  isActive?: boolean;
}

export function listMyAvailabilityRules(token: string): Promise<OwnerAvailabilityRule[]> {
  return authedFetch('/v1/profiles/me/availability-rules', token);
}

export function createAvailabilityRule(token: string, input: AvailabilityRuleInput): Promise<OwnerAvailabilityRule> {
  return authedFetch('/v1/profiles/me/availability-rules', token, { method: 'POST', body: JSON.stringify(input) });
}

export function deleteAvailabilityRule(token: string, id: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/profiles/me/availability-rules/${id}`, token, { method: 'DELETE' });
}

export function listOrgAvailabilityRules(token: string, organizationId: string): Promise<OwnerAvailabilityRule[]> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/availability-rules`, token);
}

export function createOrgAvailabilityRule(
  token: string,
  organizationId: string,
  input: AvailabilityRuleInput,
): Promise<OwnerAvailabilityRule> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/availability-rules`, token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteOrgAvailabilityRule(token: string, organizationId: string, id: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/availability-rules/${id}`, token, { method: 'DELETE' });
}

// ---- business hours ----

export interface OwnerBusinessHour {
  id: string;
  day: string;
  openMinute: number | null;
  closeMinute: number | null;
  isClosed: boolean;
}

export function listMyBusinessHours(token: string): Promise<OwnerBusinessHour[]> {
  return authedFetch('/v1/profiles/me/business-hours', token);
}

export function upsertBusinessHour(
  token: string,
  day: string,
  input: { openMinute?: number; closeMinute?: number; isClosed?: boolean },
): Promise<OwnerBusinessHour> {
  return authedFetch(`/v1/profiles/me/business-hours/${day}`, token, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteBusinessHour(token: string, day: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/profiles/me/business-hours/${day}`, token, { method: 'DELETE' });
}

export function listOrgBusinessHours(token: string, organizationId: string): Promise<OwnerBusinessHour[]> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/business-hours`, token);
}

export function upsertOrgBusinessHour(
  token: string,
  organizationId: string,
  day: string,
  input: { openMinute?: number; closeMinute?: number; isClosed?: boolean },
): Promise<OwnerBusinessHour> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/business-hours/${day}`, token, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteOrgBusinessHour(token: string, organizationId: string, day: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/business-hours/${day}`, token, { method: 'DELETE' });
}

// ---- offers ----

export interface OwnerOffer {
  id: string;
  title: string;
  description: string | null;
  validUntil: string | null;
  isActive: boolean;
}

export type OfferInput = Partial<Omit<OwnerOffer, 'id'>>;

export function listMyOffers(token: string): Promise<OwnerOffer[]> {
  return authedFetch('/v1/profiles/me/offers', token);
}

export function createOffer(token: string, input: OfferInput): Promise<OwnerOffer> {
  return authedFetch('/v1/profiles/me/offers', token, { method: 'POST', body: JSON.stringify(input) });
}

export function updateOffer(token: string, id: string, input: OfferInput): Promise<OwnerOffer> {
  return authedFetch(`/v1/profiles/me/offers/${id}`, token, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteOffer(token: string, id: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/profiles/me/offers/${id}`, token, { method: 'DELETE' });
}

export function listOrgOffers(token: string, organizationId: string): Promise<OwnerOffer[]> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/offers`, token);
}

export function createOrgOffer(token: string, organizationId: string, input: OfferInput): Promise<OwnerOffer> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/offers`, token, { method: 'POST', body: JSON.stringify(input) });
}

export function updateOrgOffer(token: string, organizationId: string, id: string, input: OfferInput): Promise<OwnerOffer> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/offers/${id}`, token, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteOrgOffer(token: string, organizationId: string, id: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/offers/${id}`, token, { method: 'DELETE' });
}

// ---- links ----

export interface OwnerCustomLink {
  id: string;
  label: string;
  url: string;
  order: number;
}

export interface OwnerSocialLink {
  id: string;
  platform: string;
  url: string;
  order: number;
}

export function listMyCustomLinks(token: string): Promise<OwnerCustomLink[]> {
  return authedFetch('/v1/profiles/me/links/custom', token);
}

export function createCustomLink(token: string, input: { label: string; url: string; order?: number }): Promise<OwnerCustomLink> {
  return authedFetch('/v1/profiles/me/links/custom', token, { method: 'POST', body: JSON.stringify(input) });
}

export function deleteCustomLink(token: string, id: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/profiles/me/links/custom/${id}`, token, { method: 'DELETE' });
}

export function listMySocialLinks(token: string): Promise<OwnerSocialLink[]> {
  return authedFetch('/v1/profiles/me/links/social', token);
}

export function createSocialLink(token: string, input: { platform: string; url: string; order?: number }): Promise<OwnerSocialLink> {
  return authedFetch('/v1/profiles/me/links/social', token, { method: 'POST', body: JSON.stringify(input) });
}

export function deleteSocialLink(token: string, id: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/profiles/me/links/social/${id}`, token, { method: 'DELETE' });
}

export function listOrgCustomLinks(token: string, organizationId: string): Promise<OwnerCustomLink[]> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/links/custom`, token);
}

export function createOrgCustomLink(
  token: string,
  organizationId: string,
  input: { label: string; url: string; order?: number },
): Promise<OwnerCustomLink> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/links/custom`, token, { method: 'POST', body: JSON.stringify(input) });
}

export function deleteOrgCustomLink(token: string, organizationId: string, id: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/links/custom/${id}`, token, { method: 'DELETE' });
}

export function listOrgSocialLinks(token: string, organizationId: string): Promise<OwnerSocialLink[]> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/links/social`, token);
}

export function createOrgSocialLink(
  token: string,
  organizationId: string,
  input: { platform: string; url: string; order?: number },
): Promise<OwnerSocialLink> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/links/social`, token, { method: 'POST', body: JSON.stringify(input) });
}

export function deleteOrgSocialLink(token: string, organizationId: string, id: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/links/social/${id}`, token, { method: 'DELETE' });
}

// ---- images ----

export interface OwnerProfileImage {
  id: string;
  kind: 'BANNER' | 'GALLERY';
  order: number;
}

export function listMyImages(token: string): Promise<OwnerProfileImage[]> {
  return authedFetch('/v1/profiles/me/images', token);
}

export function uploadGalleryImage(token: string, kind: 'BANNER' | 'GALLERY', file: File): Promise<OwnerProfileImage> {
  return authedUpload(`/v1/profiles/me/images?kind=${kind}`, token, file);
}

export function deleteImage(token: string, id: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/profiles/me/images/${id}`, token, { method: 'DELETE' });
}

export function listOrgImages(token: string, organizationId: string): Promise<OwnerProfileImage[]> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/images`, token);
}

export function uploadOrgGalleryImage(
  token: string,
  organizationId: string,
  kind: 'BANNER' | 'GALLERY',
  file: File,
): Promise<OwnerProfileImage> {
  return authedUpload(`/v1/organizations/${organizationId}/profile/images?kind=${kind}`, token, file);
}

export function deleteOrgImage(token: string, organizationId: string, id: string): Promise<{ deleted: true }> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/images/${id}`, token, { method: 'DELETE' });
}

// ---- appointments ----

export interface OwnerAppointment {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  startsAt: string;
  endsAt: string;
  visitorName: string;
  visitorPhone: string | null;
  visitorEmail: string | null;
  notes: string | null;
  service: { name: string };
}

export function listMyAppointments(token: string): Promise<OwnerAppointment[]> {
  return authedFetch('/v1/profiles/me/appointments', token);
}

export function confirmAppointment(token: string, id: string): Promise<OwnerAppointment> {
  return authedFetch(`/v1/profiles/me/appointments/${id}/confirm`, token, { method: 'POST' });
}

export function cancelAppointment(token: string, id: string): Promise<OwnerAppointment> {
  return authedFetch(`/v1/profiles/me/appointments/${id}/cancel`, token, { method: 'POST' });
}

export function listOrgAppointments(token: string, organizationId: string): Promise<OwnerAppointment[]> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/appointments`, token);
}

export function confirmOrgAppointment(token: string, organizationId: string, id: string): Promise<OwnerAppointment> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/appointments/${id}/confirm`, token, { method: 'POST' });
}

export function cancelOrgAppointment(token: string, organizationId: string, id: string): Promise<OwnerAppointment> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/appointments/${id}/cancel`, token, { method: 'POST' });
}

// ---- contact messages ----

export interface OwnerContactMessage {
  id: string;
  senderName: string;
  senderPhone: string | null;
  senderEmail: string | null;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export function listMyContactMessages(token: string): Promise<OwnerContactMessage[]> {
  return authedFetch('/v1/profiles/me/contact-messages', token);
}

export function markContactMessageRead(token: string, id: string): Promise<OwnerContactMessage> {
  return authedFetch(`/v1/profiles/me/contact-messages/${id}/read`, token, { method: 'POST' });
}

export function listOrgContactMessages(token: string, organizationId: string): Promise<OwnerContactMessage[]> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/contact-messages`, token);
}

export function markOrgContactMessageRead(token: string, organizationId: string, id: string): Promise<OwnerContactMessage> {
  return authedFetch(`/v1/organizations/${organizationId}/profile/contact-messages/${id}/read`, token, { method: 'POST' });
}

// ---- tenant memberships (Work Profile) ----

export interface TenantMembership {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: string;
}

export function getMyTenantMemberships(token: string): Promise<TenantMembership[]> {
  return authedFetch('/v1/tenants/my-memberships', token);
}

// ---- organization memberships (Work Profile) ----

export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  countryCode: string | null;
  role: string;
  isAdmin: boolean;
}

export function getMyOrganizationMemberships(token: string): Promise<OrganizationMembership[]> {
  return authedFetch('/v1/organizations/my-memberships', token);
}

export interface MembershipInvite {
  id: string;
  organizationId: string;
  role: string;
  status: string;
  createdAt: string;
}

/** GET /v1/organizations/invites/mine — this account's pending invitations. */
export function getMyInvites(token: string): Promise<MembershipInvite[]> {
  return authedFetch('/v1/organizations/invites/mine', token);
}

export function acceptInvite(token: string, membershipId: string): Promise<MembershipInvite> {
  return authedFetch(`/v1/organizations/invites/${membershipId}/accept`, token, { method: 'POST' });
}

export function declineInvite(token: string, membershipId: string): Promise<MembershipInvite> {
  return authedFetch(`/v1/organizations/invites/${membershipId}/decline`, token, { method: 'POST' });
}

export interface OrgProfile {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  isPublished: boolean;
}

/** GET /v1/organizations/:id/profile — that organization's public ("work") profile, if set up yet. */
export async function getOrganizationProfile(token: string, organizationId: string): Promise<OrgProfile | null> {
  try {
    return await authedFetch<OrgProfile>(`/v1/organizations/${organizationId}/profile`, token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** POST /v1/organizations/:id/profile — creates that organization's public profile.
 * Requires the account to be an ACTIVE admin member of a verified (KYB-approved)
 * organization (see OrganizationProfilesService::require_active_admin) — shows the
 * API's own error verbatim if not. */
export function createOrganizationProfile(
  token: string,
  organizationId: string,
  input: { slug: string; displayName: string },
): Promise<OrgProfile> {
  return authedFetch(`/v1/organizations/${organizationId}/profile`, token, { method: 'POST', body: JSON.stringify(input) });
}

// ---- brand memberships (Work Profile) ----

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

export function getMyBrandMemberships(token: string): Promise<BrandMembership[]> {
  return authedFetch('/v1/brands/my-memberships', token);
}

// ---- verification center ----

export interface AccountVerificationStatus {
  badges: Badge[];
  realName: { value: string; verifiedAt: string; cnicPhoneLinked: boolean } | null;
  cnicPhoneLinked: boolean;
  usernameEligible: boolean;
  email: { address: string | null; verifiedAt: string | null };
}

export function getVerificationStatus(token: string): Promise<AccountVerificationStatus> {
  return authedFetch('/v1/accounts/me/verification', token);
}

export function startEmailVerification(token: string, email: string): Promise<{ accepted: true }> {
  return authedFetch('/v1/accounts/me/email/start', token, { method: 'POST', body: JSON.stringify({ email }) });
}

export function verifyEmail(token: string, code: string): Promise<Account> {
  return authedFetch('/v1/accounts/me/email/verify', token, { method: 'POST', body: JSON.stringify({ code }) });
}

export type SelfServicePolicy = 'identity' | 'cnic-phone-link';

export interface SelfServiceVerificationCase {
  id: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'NEEDS_REVIEW';
  policyId: string;
  /** Present on listVerificationCases()/getVerificationCase() results; absent on createVerificationCase()'s own response (the caller already knows which policy it just requested). */
  policy?: { name: SelfServicePolicy };
  createdAt: string;
  resolvedAt: string | null;
  hostedUrl?: string;
  attempts: { method: string; status: string }[];
}

export function createVerificationCase(
  token: string,
  policyName: SelfServicePolicy,
  referenceId?: string,
): Promise<SelfServiceVerificationCase> {
  return authedFetch('/v1/accounts/me/verification/cases', token, {
    method: 'POST',
    body: JSON.stringify({ policyName, referenceId }),
  });
}

export function listVerificationCases(token: string): Promise<SelfServiceVerificationCase[]> {
  return authedFetch('/v1/accounts/me/verification/cases', token);
}

export function getVerificationCase(token: string, id: string): Promise<SelfServiceVerificationCase> {
  return authedFetch(`/v1/accounts/me/verification/cases/${id}`, token);
}
