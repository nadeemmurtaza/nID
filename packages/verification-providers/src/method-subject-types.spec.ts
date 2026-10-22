import { subjectTypesAllowedFor } from './method-subject-types';

describe('subjectTypesAllowedFor', () => {
  it('defaults an unlisted method to PERSON-only', () => {
    expect(subjectTypesAllowedFor('otp_sms')).toEqual(['PERSON']);
    expect(subjectTypesAllowedFor('document_ocr')).toEqual(['PERSON']);
    expect(subjectTypesAllowedFor('liveness')).toEqual(['PERSON']);
  });

  it('restricts the two KYB methods to ORGANIZATION', () => {
    expect(subjectTypesAllowedFor('business_registry')).toEqual(['ORGANIZATION']);
    expect(subjectTypesAllowedFor('business_registration_document')).toEqual(['ORGANIZATION']);
  });

  it('restricts org_membership to PERSON — it verifies a person\'s membership, never the org itself', () => {
    expect(subjectTypesAllowedFor('org_membership')).toEqual(['PERSON']);
  });

  it('allows agent_in_person_document for either subject type', () => {
    expect(subjectTypesAllowedFor('agent_in_person_document')).toEqual(['PERSON', 'ORGANIZATION']);
  });
});
