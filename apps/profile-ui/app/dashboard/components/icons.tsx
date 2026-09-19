import type { ReactNode } from 'react';

/** Small, hand-drawn nav icons — no icon library dependency. 18x18, stroke-only,
 * so they inherit the current text color (muted normally, accent when active). */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ProfileIcon() {
  return (
    <Icon>
      <circle cx="12" cy="7.5" r="3.25" />
      <path d="M5 19c1.2-3.7 4-5.5 7-5.5s5.8 1.8 7 5.5" />
    </Icon>
  );
}

export function ServicesIcon() {
  return (
    <Icon>
      <path d="M8 6h11M8 12h11M8 18h11" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function AvailabilityIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3.2 2" />
    </Icon>
  );
}

export function HoursIcon() {
  return (
    <Icon>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" />
    </Icon>
  );
}

export function OffersIcon() {
  return (
    <Icon>
      <path d="M12.6 4H6.5A1.5 1.5 0 0 0 5 5.5v6.1c0 .4.16.78.44 1.06l8.9 8.9c.6.6 1.55.6 2.15 0l6.6-6.6c.6-.6.6-1.55 0-2.15l-8.9-8.9A1.5 1.5 0 0 0 12.6 4Z" />
      <circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function LinksIcon() {
  return (
    <Icon>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.5l1.4-1.4a3.6 3.6 0 0 1 5.1 5.1L16 11.6" />
      <path d="M13 17.5l-1.4 1.4a3.6 3.6 0 0 1-5.1-5.1l1.4-1.4" />
    </Icon>
  );
}

export function ImagesIcon() {
  return (
    <Icon>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M20.5 16.5 15 11l-8 8.5" />
    </Icon>
  );
}

export function AppointmentsIcon() {
  return (
    <Icon>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 10h16" />
      <path d="M9 15l2 2 4-4" />
    </Icon>
  );
}

export function MessagesIcon() {
  return (
    <Icon>
      <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16H9l-4.5 4V6.5Z" />
    </Icon>
  );
}

export function PrivacyIcon() {
  return (
    <Icon>
      <path d="M12 3.5 19 6v6c0 5-3 8-7 8.5-4-.5-7-3.5-7-8.5V6l7-2.5Z" />
      <path d="M9 12l2 2 4-4" />
    </Icon>
  );
}

/** Same shield-check shape as PrivacyIcon, used for the top-level "Verification" nav item — Privacy is now one of its sub-pages, not a separate top-level concept. */
export const VerificationIcon = PrivacyIcon;
