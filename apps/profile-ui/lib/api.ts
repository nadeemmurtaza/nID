const API_URL = process.env.NEXT_PUBLIC_NID_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    // Public profile data changes whenever its owner edits it — never serve
    // a stale Next.js data-cache copy of someone else's page.
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
    throw new ApiError(message ?? `Request to ${path} failed with ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

/** Absolute URL a browser can load directly — the photo/image-bytes routes are plain GETs, not JSON. */
export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export interface Badge {
  claimType: string;
  level: string;
  verifiedAt: string | null;
  caseId: string | null;
}

export interface PublicProfile {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  category: string;
  bio: string | null;
  photoKey: string | null;
  timezone: string;
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
  showBooking: boolean;
  showOffers: boolean;
  showHours: boolean;
  badges: Badge[] | null;
  realName: string | null;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number | null;
  currency: string | null;
}

export interface Offer {
  id: string;
  title: string;
  description: string | null;
  validUntil: string | null;
}

export interface BusinessHour {
  day: string;
  openMinute: number | null;
  closeMinute: number | null;
  isClosed: boolean;
}

export interface CustomLink {
  id: string;
  label: string;
  url: string;
  order: number;
}

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
  order: number;
}

export interface ProfileLinks {
  customLinks: CustomLink[];
  socialLinks: SocialLink[];
}

export interface ProfileImageMeta {
  id: string;
  kind: 'BANNER' | 'GALLERY';
  order: number;
}

export interface FreeSlot {
  startsAt: string;
  endsAt: string;
}

export interface Appointment {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
}

export interface ContactMessage {
  id: string;
  senderName: string;
  message: string;
}

/** Fetches everything the public page needs in parallel; a 404 profile short-circuits the rest. */
export async function getPublicProfileBundle(slug: string): Promise<{
  profile: PublicProfile;
  services: Service[];
  offers: Offer[];
  businessHours: BusinessHour[];
  links: ProfileLinks;
  images: ProfileImageMeta[];
} | null> {
  let profile: PublicProfile;
  try {
    profile = await apiFetch<PublicProfile>(`/v1/profiles/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }

  const [services, offers, businessHours, links, images] = await Promise.all([
    profile.showBooking
      ? apiFetch<Service[]>(`/v1/profiles/${encodeURIComponent(slug)}/services`)
      : Promise.resolve<Service[]>([]),
    apiFetch<Offer[]>(`/v1/profiles/${encodeURIComponent(slug)}/offers`),
    apiFetch<BusinessHour[]>(`/v1/profiles/${encodeURIComponent(slug)}/business-hours`),
    apiFetch<ProfileLinks>(`/v1/profiles/${encodeURIComponent(slug)}/links`),
    apiFetch<ProfileImageMeta[]>(`/v1/profiles/${encodeURIComponent(slug)}/images`),
  ]);

  return { profile, services, offers, businessHours, links, images };
}

export function getFreeSlots(slug: string, serviceId: string, from: string, to: string): Promise<FreeSlot[]> {
  const params = new URLSearchParams({ serviceId, from, to });
  return apiFetch<FreeSlot[]>(`/v1/profiles/${encodeURIComponent(slug)}/availability?${params.toString()}`);
}

export function bookAppointment(
  slug: string,
  input: { serviceId: string; startsAt: string; visitorName: string; visitorPhone?: string; visitorEmail?: string; notes?: string },
): Promise<Appointment> {
  return apiFetch<Appointment>(`/v1/profiles/${encodeURIComponent(slug)}/appointments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function sendContactMessage(
  slug: string,
  input: { senderName: string; senderPhone?: string; senderEmail?: string; message: string },
): Promise<ContactMessage> {
  return apiFetch<ContactMessage>(`/v1/profiles/${encodeURIComponent(slug)}/contact-messages`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
