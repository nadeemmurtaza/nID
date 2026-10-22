import type { SubjectType } from '@nid/db';

/**
 * Which Subject.type a method is meaningful for. A method absent from this
 * map is PERSON-only — the default every method here carried by construction
 * before Organization-facing KYB methods existed (an org has no phone to
 * send otp_sms to, no face for liveness to match, no date of birth) — so
 * this only needs entries for the methods that genuinely diverge from that
 * default.
 *
 * Without this, nothing stops a tenant from pointing document_ocr (MRZ
 * passport parsing) at an Organization Subject, or business_registry at a
 * PERSON — both silently nonsensical rather than rejected. See
 * VerificationCasesService.create(), the one place this is enforced.
 */
export const METHOD_SUBJECT_TYPES: Record<string, SubjectType[]> = {
  // A business-registry lookup and a certificate-of-incorporation scan are
  // both meaningless for a person — see registry-check.provider.ts /
  // image-claim.provider.ts's own headers for what each actually checks.
  business_registry: ['ORGANIZATION'],
  business_registration_document: ['ORGANIZATION'],
  // An org admin's attestation that a PERSON is a confirmed member — always
  // run against the person inheriting the badge, never the Organization
  // itself (that's what the two methods above are for).
  org_membership: ['PERSON'],
  // A tenant agent physically inspecting original documents applies
  // equally to a person's government ID or an organization's certificate
  // of incorporation — the mechanism (human eye on the real artifact)
  // doesn't care which kind of Subject it's inspecting for.
  agent_in_person_document: ['PERSON', 'ORGANIZATION'],
};

const DEFAULT_SUBJECT_TYPES: SubjectType[] = ['PERSON'];

export function subjectTypesAllowedFor(method: string): SubjectType[] {
  return METHOD_SUBJECT_TYPES[method] ?? DEFAULT_SUBJECT_TYPES;
}
