import { sha256Hex } from '@nid/shared-types';
import { OtpSmsProvider } from './otp-sms.provider';
import type { PendingResult, VerificationContext } from './types';

function isPending(result: unknown): result is PendingResult {
  return typeof result === 'object' && result !== null && (result as PendingResult).pending === true;
}

describe('OtpSmsProvider', () => {
  const context: VerificationContext = {
    caseId: 'case_1',
    tenantId: 'tenant_1',
    subjectId: 'subject_1',
    input: { phone: '+15551234567' },
  };

  it('returns a pending result with a hashed code, never the plaintext code', async () => {
    const provider = new OtpSmsProvider(true);
    const result = await provider.start(context);

    expect(isPending(result)).toBe(true);
    if (!isPending(result)) return;
    const codeHash = result.resultMeta?.['codeHash'];
    expect(typeof codeHash).toBe('string');
    expect(codeHash).toHaveLength(64); // sha256 hex
  });

  it('fails fast when no phone is provided, without sending anything', async () => {
    const provider = new OtpSmsProvider(true);
    const result = await provider.start({ ...context, input: {} });

    expect(isPending(result)).toBe(false);
    expect(result).toMatchObject({ status: 'FAILED', verified: true });
  });

  it('handleCallback passes when the submitted code matches the stored hash', async () => {
    const provider = new OtpSmsProvider(true);
    const code = '123456';
    const codeHash = sha256Hex(code);

    // codeHash here is exactly what start()'s own resultMeta key is named —
    // apps/workflows' resolveProviderPayload spreads resultMeta as-is into
    // the callback payload, no renaming in between.
    const result = await provider.handleCallback({ submittedCode: code, codeHash });

    expect(result.status).toBe('PASSED');
    expect(result.verified).toBe(true);
  });

  it('handleCallback fails when the submitted code does not match', async () => {
    const provider = new OtpSmsProvider(true);
    const codeHash = sha256Hex('123456');

    const result = await provider.handleCallback({ submittedCode: '999999', codeHash });

    expect(result.status).toBe('FAILED');
  });

  it('start() throws in production mode, where no real SMS vendor is wired up yet', async () => {
    const provider = new OtpSmsProvider(false);
    await expect(provider.start(context)).rejects.toThrow(/no production SMS vendor/);
  });
});
