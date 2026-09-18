import { sha256Hex } from '@nid/shared-types';
import { createPrismaClient, type PrismaClient } from '@nid/db';
import { AddressPostalOtpProvider } from './address-postal-otp.provider';

describe('AddressPostalOtpProvider.handleCallback (pure hash-compare logic, no DB)', () => {
  const provider = new AddressPostalOtpProvider({} as PrismaClient, true);

  it('passes when the submitted code matches the stored hash', async () => {
    const code = '654321';
    const codeHash = sha256Hex(code);
    const result = await provider.handleCallback({ submittedCode: code, codeHash });
    expect(result.status).toBe('PASSED');
    expect(result.verified).toBe(true);
  });

  it('fails when the submitted code does not match', async () => {
    const codeHash = sha256Hex('654321');
    const result = await provider.handleCallback({ submittedCode: '000000', codeHash });
    expect(result.status).toBe('FAILED');
  });

  it('rejects a malformed callback as unverified, not a genuine FAILED claim', async () => {
    const result = await provider.handleCallback({ submittedCode: '123456' });
    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(false);
    expect(result.raw['reason']).toBe('malformed_callback');
  });
});

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('AddressPostalOtpProvider.start (live Postgres)', () => {
  const migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
  const appPrisma = createPrismaClient(process.env['APP_DATABASE_URL']);

  afterAll(async () => {
    await migratorPrisma.$disconnect();
    await appPrisma.$disconnect();
  });

  it('dev mode: a subject with a full claimed address goes pending with a real hashed code', async () => {
    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug: 'postal-otp-test' },
      update: {},
      create: { name: 'Postal OTP Test', slug: 'postal-otp-test' },
    });
    const subject = await migratorPrisma.subject.create({
      data: {
        tenantId: tenant.id,
        type: 'PERSON',
        addressLine1: '123 Main St',
        city: 'Lahore',
        countryCode: 'PK',
      },
    });

    const provider = new AddressPostalOtpProvider(appPrisma, true);
    const result = await provider.start({ caseId: 'x', tenantId: tenant.id, subjectId: subject.id, input: {} });
    expect('pending' in result && result.pending).toBe(true);
    const codeHash = 'resultMeta' in result ? result.resultMeta?.['codeHash'] : undefined;
    expect(typeof codeHash).toBe('string');
    expect(codeHash).toHaveLength(64);
  });

  it('fails closed when the subject has no claimed address on file', async () => {
    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug: 'postal-otp-test-no-address' },
      update: {},
      create: { name: 'Postal OTP Test No Address', slug: 'postal-otp-test-no-address' },
    });
    const subject = await migratorPrisma.subject.create({ data: { tenantId: tenant.id, type: 'PERSON' } });

    const provider = new AddressPostalOtpProvider(appPrisma, true);
    const result = await provider.start({ caseId: 'x', tenantId: tenant.id, subjectId: subject.id, input: {} });
    expect('status' in result && result.status).toBe('FAILED');
    expect('raw' in result && result.raw['reason']).toBe('no_claimed_address_on_file');
  });

  it('production mode throws a clear error when no real postal vendor is configured', async () => {
    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug: 'postal-otp-test-prod' },
      update: {},
      create: { name: 'Postal OTP Test Prod', slug: 'postal-otp-test-prod' },
    });
    const subject = await migratorPrisma.subject.create({
      data: { tenantId: tenant.id, type: 'PERSON', addressLine1: '456 Oak Ave', city: 'Karachi', countryCode: 'PK' },
    });

    const provider = new AddressPostalOtpProvider(appPrisma, false);
    await expect(
      provider.start({ caseId: 'x', tenantId: tenant.id, subjectId: subject.id, input: {} }),
    ).rejects.toThrow(/no production postal vendor/);
  });
});
