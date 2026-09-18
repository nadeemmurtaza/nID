import { createPrismaClient, type PrismaClient } from '@nid/db';
import { AddressGpsMatchProvider } from './address-gps-match.provider';

describe('AddressGpsMatchProvider.handleCallback (pure distance logic, no DB)', () => {
  // handleCallback never touches the database — this client is never called.
  const provider = new AddressGpsMatchProvider({} as PrismaClient);

  it('passes when the reported location is within range of the claimed address', () => {
    return provider
      .handleCallback({ latitude: 24.8607, longitude: 67.0011, expectedLatitude: 24.8608, expectedLongitude: 67.0012 })
      .then((result) => {
        expect(result.status).toBe('PASSED');
        expect(result.verified).toBe(true);
        expect(result.raw['distanceMeters']).toBeLessThan(500);
      });
  });

  it('needs review, not FAILED, when the reported location is far from the claimed address', async () => {
    // Karachi vs. Lahore — genuinely, clearly a different city.
    const result = await provider.handleCallback({
      latitude: 24.8607,
      longitude: 67.0011,
      expectedLatitude: 31.5204,
      expectedLongitude: 74.3587,
    });
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.verified).toBe(true);
    expect(result.raw['distanceMeters']).toBeGreaterThan(1_000_000);
  });

  it('fails closed on missing/malformed coordinates rather than guessing', async () => {
    const result = await provider.handleCallback({ latitude: 24.8607 });
    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(false);
    expect(result.raw['reason']).toBe('missing_coordinates');
  });

  it('a custom max distance is honored', async () => {
    const tight = new AddressGpsMatchProvider({} as PrismaClient, 10);
    const result = await tight.handleCallback({
      latitude: 24.8607,
      longitude: 67.0011,
      expectedLatitude: 24.8608,
      expectedLongitude: 67.0012,
    });
    expect(result.status).toBe('NEEDS_REVIEW');
  });
});

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('AddressGpsMatchProvider.start (live Postgres)', () => {
  const migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
  const appPrisma = createPrismaClient(process.env['APP_DATABASE_URL']);
  const provider = new AddressGpsMatchProvider(appPrisma);

  afterAll(async () => {
    await migratorPrisma.$disconnect();
    await appPrisma.$disconnect();
  });

  it('a subject with claimed coordinates goes pending with those coordinates as resultMeta', async () => {
    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug: 'gps-match-test' },
      update: {},
      create: { name: 'GPS Match Test', slug: 'gps-match-test' },
    });
    const subject = await migratorPrisma.subject.create({
      data: { tenantId: tenant.id, type: 'PERSON', latitude: 24.8607, longitude: 67.0011 },
    });

    const result = await provider.start({ caseId: 'x', tenantId: tenant.id, subjectId: subject.id, input: {} });
    expect('pending' in result && result.pending).toBe(true);
    expect('resultMeta' in result && result.resultMeta).toEqual({ expectedLatitude: 24.8607, expectedLongitude: 67.0011 });
  });

  it('a subject with no claimed coordinates on file fails closed', async () => {
    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug: 'gps-match-test-no-coords' },
      update: {},
      create: { name: 'GPS Match Test No Coords', slug: 'gps-match-test-no-coords' },
    });
    const subject = await migratorPrisma.subject.create({ data: { tenantId: tenant.id, type: 'PERSON' } });

    const result = await provider.start({ caseId: 'x', tenantId: tenant.id, subjectId: subject.id, input: {} });
    expect('status' in result && result.status).toBe('FAILED');
    expect('raw' in result && result.raw['reason']).toBe('no_claimed_address_coordinates');
  });
});
