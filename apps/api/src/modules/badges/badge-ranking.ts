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
