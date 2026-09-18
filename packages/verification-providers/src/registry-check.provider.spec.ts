import { RegistryCheckProvider } from './registry-check.provider';
import type { VerificationContext } from './types';

describe('RegistryCheckProvider', () => {
  const context: VerificationContext = {
    caseId: 'case_1',
    tenantId: 'tenant_1',
    subjectId: 'subject_1',
    input: { referenceId: 'STU-12345' },
  };

  it('resolves synchronously in dev mode — no upload to wait for, unlike ImageClaimProvider', async () => {
    const provider = new RegistryCheckProvider('education_registry', 'Education registry check', true);
    const result = await provider.start(context);

    expect('pending' in result).toBe(false);
    if ('pending' in result) return;
    expect(result.status).toBe('PASSED');
    expect(result.verified).toBe(true);
    expect(result.raw).toMatchObject({ mode: 'dev_mock', referenceId: 'STU-12345' });
  });

  it('respects an explicit mockOutcome in the case input for deterministic testing', async () => {
    const provider = new RegistryCheckProvider('employment_registry', 'Employment registry check', true);
    const result = await provider.start({ ...context, input: { ...context.input, mockOutcome: 'FAILED' } });

    expect('pending' in result).toBe(false);
    if ('pending' in result) return;
    expect(result.status).toBe('FAILED');
  });

  it('exposes whatever key/label it was instantiated with', () => {
    const provider = new RegistryCheckProvider('employment_registry', 'Employment registry check', true);
    expect(provider.key).toBe('employment_registry');
    expect(provider.label).toBe('Employment registry check');
  });

  it('throws in production mode when no apiUrl/apiKey is configured for this method', async () => {
    const provider = new RegistryCheckProvider('education_registry', 'Education registry check', false);
    await expect(provider.start(context)).rejects.toThrow(/education_registry: no registry API configured/);
  });

  describe('production mode with a configured registry API', () => {
    const originalFetch = global.fetch;
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('POSTs the generic contract and passes through a PASSED result', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'PASSED', score: 0.9, raw: { institution: 'Test University' } }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const provider = new RegistryCheckProvider('education_registry', 'Education registry check', false, {
        apiUrl: 'https://registry.example.test/checks',
        apiKey: 'test-key',
      });
      const result = await provider.start(context);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://registry.example.test/checks',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ authorization: 'Bearer test-key' }),
        }),
      );
      const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
      expect(sentBody).toMatchObject({ method: 'education_registry', referenceId: 'STU-12345' });

      expect('pending' in result).toBe(false);
      if ('pending' in result) return;
      expect(result.status).toBe('PASSED');
      expect(result.verified).toBe(true);
      expect(result.raw).toMatchObject({ source: 'registry_api', institution: 'Test University' });
    });

    it('is unverified, not a genuine FAILED, when the registry is unreachable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

      const provider = new RegistryCheckProvider('employment_registry', 'Employment registry check', false, {
        apiUrl: 'https://registry.example.test/checks',
        apiKey: 'test-key',
      });
      const result = await provider.start(context);

      expect('pending' in result).toBe(false);
      if ('pending' in result) return;
      expect(result.status).toBe('FAILED');
      expect(result.verified).toBe(false);
      expect(result.raw).toMatchObject({ reason: 'registry_unreachable' });
    });

    it('rejects a malformed registry response rather than trusting it', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: 'shape' }),
      }) as unknown as typeof fetch;

      const provider = new RegistryCheckProvider('education_registry', 'Education registry check', false, {
        apiUrl: 'https://registry.example.test/checks',
        apiKey: 'test-key',
      });
      const result = await provider.start(context);

      expect('pending' in result).toBe(false);
      if ('pending' in result) return;
      expect(result.status).toBe('FAILED');
      expect(result.verified).toBe(false);
      expect(result.raw).toMatchObject({ reason: 'malformed_registry_response' });
    });

    it('fails closed on a missing referenceId instead of calling the registry at all', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const provider = new RegistryCheckProvider('education_registry', 'Education registry check', false, {
        apiUrl: 'https://registry.example.test/checks',
        apiKey: 'test-key',
      });
      const result = await provider.start({ ...context, input: {} });

      expect(fetchMock).not.toHaveBeenCalled();
      expect('pending' in result).toBe(false);
      if ('pending' in result) return;
      expect(result.status).toBe('FAILED');
      expect(result.verified).toBe(false);
      expect(result.raw).toMatchObject({ reason: 'missing_reference_id' });
    });

    it('sends accountTitle for bank_account_title, since the vendor has no other way to know the claimed name', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'PASSED', raw: {} }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const provider = new RegistryCheckProvider('bank_account_title', 'Bank account title check', false, {
        apiUrl: 'https://bank.example.test/checks',
        apiKey: 'test-key',
      });
      await provider.start({
        ...context,
        input: { referenceId: 'PK00BANK0000012345678901', accountTitle: 'Jane Q. Subject' },
      });

      const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
      expect(sentBody).toMatchObject({
        method: 'bank_account_title',
        referenceId: 'PK00BANK0000012345678901',
        accountTitle: 'Jane Q. Subject',
      });
    });

    it('never sends an accountTitle field for education/employment registries — they resolve identity from referenceId alone', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'PASSED', raw: {} }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const provider = new RegistryCheckProvider('education_registry', 'Education registry check', false, {
        apiUrl: 'https://registry.example.test/checks',
        apiKey: 'test-key',
      });
      await provider.start(context);

      const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
      expect(sentBody).not.toHaveProperty('accountTitle');
    });

    it('fails closed on a missing accountTitle for bank_account_title instead of calling the vendor at all', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const provider = new RegistryCheckProvider('bank_account_title', 'Bank account title check', false, {
        apiUrl: 'https://bank.example.test/checks',
        apiKey: 'test-key',
      });
      const result = await provider.start({ ...context, input: { referenceId: 'PK00BANK0000012345678901' } });

      expect(fetchMock).not.toHaveBeenCalled();
      expect('pending' in result).toBe(false);
      if ('pending' in result) return;
      expect(result.status).toBe('FAILED');
      expect(result.raw).toMatchObject({ reason: 'missing_account_title' });
    });

    it('sends phone for estamp_registry, since the vendor has no other way to know the claimed number', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'PASSED', raw: {} }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const provider = new RegistryCheckProvider('estamp_registry', 'E-stamp CNIC+phone registry check', false, {
        apiUrl: 'https://estamp.example.test/checks',
        apiKey: 'test-key',
      });
      await provider.start({
        ...context,
        input: { referenceId: '35202-1234567-8', phone: '+923001234567' },
      });

      const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
      expect(sentBody).toMatchObject({
        method: 'estamp_registry',
        referenceId: '35202-1234567-8',
        phone: '+923001234567',
      });
      expect(sentBody).not.toHaveProperty('accountTitle');
    });

    it('never sends a phone field for bank_account_title or education/employment registries', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'PASSED', raw: {} }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const provider = new RegistryCheckProvider('bank_account_title', 'Bank account title check', false, {
        apiUrl: 'https://bank.example.test/checks',
        apiKey: 'test-key',
      });
      await provider.start({
        ...context,
        input: { referenceId: 'PK00BANK0000012345678901', accountTitle: 'Jane Q. Subject' },
      });

      const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
      expect(sentBody).not.toHaveProperty('phone');
    });

    it('fails closed on a missing phone for estamp_registry instead of calling the vendor at all', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const provider = new RegistryCheckProvider('estamp_registry', 'E-stamp CNIC+phone registry check', false, {
        apiUrl: 'https://estamp.example.test/checks',
        apiKey: 'test-key',
      });
      const result = await provider.start({ ...context, input: { referenceId: '35202-1234567-8' } });

      expect(fetchMock).not.toHaveBeenCalled();
      expect('pending' in result).toBe(false);
      if ('pending' in result) return;
      expect(result.status).toBe('FAILED');
      expect(result.raw).toMatchObject({ reason: 'missing_phone' });
    });
  });
});
