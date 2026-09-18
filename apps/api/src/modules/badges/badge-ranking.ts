export interface Badge {
  claimType: string;
  level: string;
  verifiedAt: Date | null;
  caseId: string | null;
}

export interface RankableEvidence {
  claimType: string;
  level: string;
  verifiedAt: Date | null;
  caseId: string | null;
}

/**
 * Shared by SubjectsService.getBadges (one tenant's own Subject) and
 * ProfilesService's cross-tenant Account badges (packages/db/prisma's
 * PhoneBadgeEvidence) — the exact same strongest-per-claimType ranking,
 * reused rather than duplicated (docs/HOUSE-RULES.md rule 1).
 *
 * Callers must pass `evidence` already ordered strongest-first per
 * claimType — Postgres orders VerificationLevel by declaration order, so
 * `ORDER BY level DESC` on either query produces that order — this
 * function only keeps the first row it sees per claimType.
 */
export function pickStrongestPerClaimType(evidence: RankableEvidence[]): Badge[] {
  const badges = new Map<string, Badge>();
  for (const item of evidence) {
    if (!badges.has(item.claimType)) {
      badges.set(item.claimType, {
        claimType: item.claimType,
        level: item.level,
        verifiedAt: item.verifiedAt,
        caseId: item.caseId,
      });
    }
  }
  return Array.from(badges.values());
}

export interface AttributeBadge {
  attribute: string;
  level: string;
  verifiedAt: Date | null;
  caseId: string | null;
  method: string | null;
}

export interface RankableAttributeEvidence {
  attribute: string;
  level: string;
  verifiedAt: Date | null;
  caseId: string | null;
  method: string | null;
}

/**
 * Same strongest-first-wins shape as pickStrongestPerClaimType, kept as its
 * own small function rather than a shared generic — the two are
 * structurally identical (rank by VerificationLevel, keep first-seen per
 * key) but genuinely different domain concepts: a claimType/level badge is
 * a whole VerificationCase's outcome, an attribute badge is one real-world
 * fact (NAME, CNIC, PHONE, ...) that any single PASSED method attempt
 * inside a case can contribute — see VerifiedAttribute's schema.prisma
 * comment and method-attributes.ts for how those rows get written.
 * Callers must pass `evidence` already ordered strongest-first per
 * attribute (`ORDER BY level DESC`, same VerificationLevel declaration-order
 * trick every other ranking in this codebase relies on).
 */
export function pickStrongestPerAttribute(evidence: RankableAttributeEvidence[]): AttributeBadge[] {
  const badges = new Map<string, AttributeBadge>();
  for (const item of evidence) {
    if (!badges.has(item.attribute)) {
      badges.set(item.attribute, {
        attribute: item.attribute,
        level: item.level,
        verifiedAt: item.verifiedAt,
        caseId: item.caseId,
        method: item.method,
      });
    }
  }
  return Array.from(badges.values());
}
