/**
 * "Username will for sure contain the realname in priority" — a chosen
 * slug isn't an arbitrary string; it has to be built from whatever real
 * name evidence actually backs it (a person's verified legal name from
 * PhoneNameEvidence, or an Organization's verified legalName). This is the
 * one place that rule is decided, reused by both ProfilesService.create()
 * (personal) and createForOrganization() (brand).
 */

/** Same normalization for either a person's "given family" or an Organization's legalName. */
export function slugifyRealName(realName: string): string {
  return realName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (e.g. "José" -> "Jose")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A chosen slug must EITHER equal the real name's own slug, or extend it
 * with a hyphenated suffix for disambiguation (the base is already taken,
 * or the person wants a qualifier like a city or a middle initial) — never
 * something unrelated to the verified name. Empty realNameSlug (should
 * never happen once a name has been verified — see the FAILED tests this
 * guards) always fails closed rather than accepting anything.
 */
export function slugMatchesRealName(slug: string, realNameSlug: string): boolean {
  if (!realNameSlug) return false;
  return slug === realNameSlug || slug.startsWith(`${realNameSlug}-`);
}
