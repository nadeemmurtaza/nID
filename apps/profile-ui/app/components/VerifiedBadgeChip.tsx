'use client';

import { CheckIcon } from 'lucide-animated';

/**
 * `'use client'` for one icon: `lucide-animated` components hold hover state in
 * hooks and ship no client boundary of their own, so they cannot render inside
 * this Server Component's tree.
 */
export function VerifiedBadgeChip({ label }: { label: string }) {
  return (
    <span className="badge-chip">
      <CheckIcon size={12} className="nid-icon" />
      {label}
    </span>
  );
}
