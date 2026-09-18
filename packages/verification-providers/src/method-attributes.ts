import type { AttributeType, VerificationLevel } from '@nid/db';

/**
 * The static, predefined "this method, once PASSED, proves exactly these
 * real-world facts, at this strength" mapping — the whole point of
 * attribute-level badges (as opposed to VerificationCase's own coarser
 * claimType/level) is that ONE method can prove SEVERAL attributes at
 * once (an e-stamp registry check confirms NAME + NATIONAL_ID_NUMBER +
 * PHONE together, since Pakistani e-stamp purchase requires the original
 * CNIC and only accepts a phone number already linked to that CNIC — real
 * third-party evidence tying all three together, not three separate
 * checks), while another proves exactly one (otp_sms proves nothing but
 * PHONE control).
 *
 * A method absent from this map proves none of AttributeType's values —
 * that's a real, deliberate fact about several methods, not an oversight:
 * `liveness` confirms the live subject matches their submitted document,
 * which is an identity-binding/anti-fraud signal, not an independent
 * attestation of any one printed fact; `org_membership` inherits an
 * already-established identity's trust rather than proving a new fact
 * about it; `education_document`/`employment_document`/
 * `education_registry`/`employment_registry`/`ecp_voter_registration`
 * each prove something entirely outside this enum's domain (an EDUCATION/
 * EMPLOYMENT claim, or a voter-registration status that never actually
 * resolves to PASSED in the first place); `business_registry`/
 * `business_registration_document` likewise prove an Organization's own
 * KYB IDENTITY claim (see organizations.service.ts's `isVerified`
 * derivation), not a fact about any one AttributeType — every value this
 * enum declares assumes a PERSON Subject (see method-subject-types.ts for
 * which Subject.type each method applies to).
 *
 * `estamp_registry`/`address_gps_match`/`address_utility_bill`/
 * `address_postal_otp` were all declared here before their providers
 * landed (see docs/PHASES.md) — the attribute wiring was correct the
 * moment each one shipped, not bolted on after.
 */
export interface MethodAttributeMapping {
  attributes: AttributeType[];
  level: VerificationLevel;
}

export const METHOD_ATTRIBUTES: Record<string, MethodAttributeMapping> = {
  // Possession/control only — matches VerificationLevel.SELF_ATTESTED's own
  // schema.prisma doc comment, which names otp_sms as its canonical example.
  otp_sms: { attributes: ['PHONE'], level: 'SELF_ATTESTED' },

  // A scanned government ID's printed fields — real evidence once OCR'd,
  // same DOCUMENT_VERIFIED tier the rest of this codebase already uses for
  // document_ocr's own ClaimType-level badge.
  document_ocr: { attributes: ['NAME', 'DATE_OF_BIRTH', 'NATIONAL_ID_NUMBER'], level: 'DOCUMENT_VERIFIED' },
  dob_document: { attributes: ['DATE_OF_BIRTH'], level: 'DOCUMENT_VERIFIED' },

  // A tenant agent physically inspected the original document — the same
  // facts document_ocr reads from a photo, just confirmed by a human eye
  // on the real artifact instead of OCR.
  agent_in_person_document: {
    attributes: ['NAME', 'DATE_OF_BIRTH', 'NATIONAL_ID_NUMBER'],
    level: 'DOCUMENT_VERIFIED',
  },

  // The bank's own records confirm the account belongs to this claimed
  // name — an authoritative third-party source, same REGISTRY_VERIFIED
  // reasoning registry-check.provider.ts's own header comment gives.
  bank_account_title: { attributes: ['NAME'], level: 'REGISTRY_VERIFIED' },

  // Pakistani e-stamp purchase/registration requires the original CNIC and
  // only accepts a phone number already linked to that CNIC — real
  // third-party evidence tying name + national ID + phone together in one
  // check (see registry-check.provider.ts's header comment for exactly
  // what a real vendor integration requires — a devolved, per-province
  // system with no single national API).
  estamp_registry: { attributes: ['NAME', 'NATIONAL_ID_NUMBER', 'PHONE'], level: 'REGISTRY_VERIFIED' },

  // Three independent ways to prove the same ADDRESS attribute — see
  // address-gps-match.provider.ts / address-utility-bill (an ImageClaimProvider
  // instance) / address-postal-otp.provider.ts.
  address_gps_match: { attributes: ['ADDRESS'], level: 'DOCUMENT_VERIFIED' },
  address_utility_bill: { attributes: ['ADDRESS'], level: 'DOCUMENT_VERIFIED' },
  // Physical mail delivery to the claimed address and a real code entered
  // back is a genuinely stronger channel than a self-uploaded bill photo —
  // the postal system itself is the authoritative third party attesting
  // the address is real and reachable.
  address_postal_otp: { attributes: ['ADDRESS'], level: 'REGISTRY_VERIFIED' },
};

export function attributesProvenBy(method: string): MethodAttributeMapping | undefined {
  return METHOD_ATTRIBUTES[method];
}
