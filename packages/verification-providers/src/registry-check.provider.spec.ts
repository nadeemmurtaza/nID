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

  it('throws in production mode, where no real registry vendor is wired up for either ClaimType yet', async () => {
    const provider = new RegistryCheckProvider('education_registry', 'Education registry check', false);
    await expect(provider.start(context)).rejects.toThrow(/education_registry: no production registry vendor/);
  });
});
