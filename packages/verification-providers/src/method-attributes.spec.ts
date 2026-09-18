import { attributesProvenBy, METHOD_ATTRIBUTES } from './method-attributes';

describe('method-attributes', () => {
  it('otp_sms proves PHONE only, at SELF_ATTESTED — possession, not identity', () => {
    expect(attributesProvenBy('otp_sms')).toEqual({ attributes: ['PHONE'], level: 'SELF_ATTESTED' });
  });

  it('estamp_registry proves NAME, NATIONAL_ID_NUMBER, and PHONE together, at REGISTRY_VERIFIED', () => {
    expect(attributesProvenBy('estamp_registry')).toEqual({
      attributes: ['NAME', 'NATIONAL_ID_NUMBER', 'PHONE'],
      level: 'REGISTRY_VERIFIED',
    });
  });

  it('a method with no attribute stake (liveness, org_membership) is genuinely absent, not an empty array', () => {
    expect(attributesProvenBy('liveness')).toBeUndefined();
    expect(attributesProvenBy('org_membership')).toBeUndefined();
    expect(attributesProvenBy('education_document')).toBeUndefined();
  });

  it('an unknown method key is undefined, never a fabricated mapping', () => {
    expect(attributesProvenBy('not_a_real_method')).toBeUndefined();
  });

  it('every declared mapping names at least one attribute', () => {
    for (const mapping of Object.values(METHOD_ATTRIBUTES)) {
      expect(mapping.attributes.length).toBeGreaterThan(0);
      expect(mapping.level).toBeTruthy();
      // Sanity: no method claims to prove the same attribute twice.
      expect(new Set(mapping.attributes).size).toBe(mapping.attributes.length);
    }
  });
});
