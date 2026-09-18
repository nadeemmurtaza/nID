const WEEKDAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const WEEKDAY_LABEL: Record<string, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

export function sortByWeekday<T extends { day: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day));
}

export function weekdayLabel(day: string): string {
  return WEEKDAY_LABEL[day] ?? day;
}

export function minuteOfDayLabel(minute: number): string {
  const hour24 = Math.floor(minute / 60);
  const min = minute % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(min).padStart(2, '0')} ${period}`;
}

const CLAIM_TYPE_LABEL: Record<string, string> = {
  IDENTITY: 'Identity',
  DATE_OF_BIRTH: 'Date of birth',
  EDUCATION: 'Education',
  EMPLOYMENT: 'Employment',
};

const LEVEL_LABEL: Record<string, string> = {
  SELF_ATTESTED: 'self-attested',
  DOCUMENT_VERIFIED: 'document-verified',
  REGISTRY_VERIFIED: 'registry-verified',
};

export function badgeLabel(claimType: string, level: string): string {
  const claim = CLAIM_TYPE_LABEL[claimType] ?? claimType;
  const lvl = LEVEL_LABEL[level] ?? level;
  return `${claim} · ${lvl}`;
}

export function formatPrice(price: number | null, currency: string | null): string | null {
  if (price === null) {
    return null;
  }
  return currency ? `${currency} ${price}` : String(price);
}

export function mapUrl(profile: {
  latitude: number | null;
  longitude: number | null;
  addressLine1: string | null;
  city: string | null;
}): string | null {
  if (profile.latitude !== null && profile.longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${profile.latitude},${profile.longitude}`;
  }
  const parts = [profile.addressLine1, profile.city].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

export function waLink(whatsapp: string): string {
  const digits = whatsapp.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}`;
}
