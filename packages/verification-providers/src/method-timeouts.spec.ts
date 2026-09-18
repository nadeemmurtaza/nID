import { methodTimeout, DEFAULT_METHOD_TIMEOUT, METHOD_TIMEOUTS } from './method-timeouts';

describe('methodTimeout', () => {
  it('address_postal_otp gets a multi-day timeout — physical mail cannot arrive in minutes', () => {
    expect(methodTimeout('address_postal_otp')).toBe('7 days');
  });

  it('every other method falls back to the shared default', () => {
    expect(methodTimeout('otp_sms')).toBe(DEFAULT_METHOD_TIMEOUT);
    expect(methodTimeout('document_ocr')).toBe(DEFAULT_METHOD_TIMEOUT);
    expect(methodTimeout('a_method_that_does_not_exist')).toBe(DEFAULT_METHOD_TIMEOUT);
  });

  it('METHOD_TIMEOUTS only overrides methods that genuinely need more than the default', () => {
    expect(Object.keys(METHOD_TIMEOUTS)).toEqual(['address_postal_otp']);
  });
});
