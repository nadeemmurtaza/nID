/** The nID mark — an "N" for the identity, a checkmark for "verified." Same source as app/icon.svg (the favicon), just inline so it can sit next to the wordmark at any size without a network request. */
export function Logomark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="120" height="120" rx="30" fill="#2f6fed" />
      <path d="M38 90V46h11.5l29 30.5V46H90v44H78.5l-29-30.5V90H38Z" fill="#ffffff" />
      <circle cx="97" cy="97" r="23" fill="#1a8a5f" stroke="#ffffff" strokeWidth="4" />
      <path
        d="M87 97.5 93.5 104 108 89.5"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
