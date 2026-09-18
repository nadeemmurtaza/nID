import { pickStrongestPerClaimType, type RankableEvidence } from './badge-ranking';

describe('pickStrongestPerClaimType', () => {
  it('keeps the first row it sees per claimType — callers are responsible for strongest-first ordering', () => {
    const evidence: RankableEvidence[] = [
      { claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED', verifiedAt: new Date('2026-01-02'), caseId: 'case-strong' },
      { claimType: 'IDENTITY', level: 'SELF_ATTESTED', verifiedAt: null, caseId: 'case-weak' },
    ];
    const badges = pickStrongestPerClaimType(evidence);
    expect(badges).toEqual([
      { claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED', verifiedAt: new Date('2026-01-02'), caseId: 'case-strong' },
    ]);
  });

  it('a weaker row appended later never overwrites the stronger one already kept (the SELF_ATTESTED-DOB-fallback pattern)', () => {
    const evidence: RankableEvidence[] = [
      { claimType: 'DATE_OF_BIRTH', level: 'DOCUMENT_VERIFIED', verifiedAt: new Date('2026-01-01'), caseId: 'case-1' },
      // Appended last, exactly as SubjectsService.getBadges and
      // CrossTenantBadgesService both do for the self-attested fallback.
      { claimType: 'DATE_OF_BIRTH', level: 'SELF_ATTESTED', verifiedAt: null, caseId: null },
    ];
    const badges = pickStrongestPerClaimType(evidence);
    expect(badges).toHaveLength(1);
    expect(badges[0]?.level).toBe('DOCUMENT_VERIFIED');
  });

  it('keeps one badge per distinct claimType', () => {
    const evidence: RankableEvidence[] = [
      { claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED', verifiedAt: null, caseId: 'a' },
      { claimType: 'EDUCATION', level: 'DOCUMENT_VERIFIED', verifiedAt: null, caseId: 'b' },
    ];
    expect(pickStrongestPerClaimType(evidence).map((b) => b.claimType).sort()).toEqual(['EDUCATION', 'IDENTITY']);
  });

  it('returns an empty array for no evidence', () => {
    expect(pickStrongestPerClaimType([])).toEqual([]);
  });
});
