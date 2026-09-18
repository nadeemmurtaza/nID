import { SelfReportedCheckProvider } from './self-reported-check.provider';

describe('SelfReportedCheckProvider', () => {
  it('always goes pending on start() — nothing to check until the subject reports back', async () => {
    const provider = new SelfReportedCheckProvider('ecp_voter_registration', 'ECP voter registration self-report');
    const result = await provider.start();
    expect(result).toEqual({ pending: true });
  });

  it('never auto-passes: a real, well-formed self-report still lands on NEEDS_REVIEW', async () => {
    const provider = new SelfReportedCheckProvider('ecp_voter_registration', 'ECP voter registration self-report');
    const result = await provider.handleCallback({ reportedValue: 'Registered — Lahore NA-130' });

    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.verified).toBe(true);
    expect(result.raw).toEqual({ reportedValue: 'Registered — Lahore NA-130' });
  });

  it('trims whitespace from the reported value', async () => {
    const provider = new SelfReportedCheckProvider('ecp_voter_registration', 'ECP voter registration self-report');
    const result = await provider.handleCallback({ reportedValue: '  Not Registered  ' });
    expect(result.raw).toEqual({ reportedValue: 'Not Registered' });
  });

  it('fails closed on a missing or blank reportedValue rather than silently reviewing nothing', async () => {
    const provider = new SelfReportedCheckProvider('ecp_voter_registration', 'ECP voter registration self-report');

    const missing = await provider.handleCallback({});
    expect(missing.status).toBe('FAILED');
    expect(missing.verified).toBe(false);
    expect(missing.raw).toEqual({ reason: 'missing_reported_value' });

    const blank = await provider.handleCallback({ reportedValue: '   ' });
    expect(blank.status).toBe('FAILED');
    expect(blank.verified).toBe(false);
  });

  it('exposes whatever key/label it was instantiated with', () => {
    const provider = new SelfReportedCheckProvider('ecp_voter_registration', 'ECP voter registration self-report');
    expect(provider.key).toBe('ecp_voter_registration');
    expect(provider.label).toBe('ECP voter registration self-report');
  });
});
