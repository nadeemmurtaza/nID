import { randomBytes } from 'node:crypto';
import { generateApiKey, generateSessionToken, sha256Hex } from '@nid/shared-types';
import { createPrismaClient } from '../src/index';

/**
 * Creates two tenants so tenant-isolation can actually be exercised —
 * see apps/api/test/tenant-isolation.spec.ts and README.md's Phase 0
 * acceptance criteria. Safe to run more than once: it upserts by slug.
 */
async function main(): Promise<void> {
  const prisma = createPrismaClient();

  for (const slug of ['tenant-a', 'tenant-b']) {
    const tenant = await prisma.tenant.upsert({
      where: { slug },
      update: {},
      create: { name: slug === 'tenant-a' ? 'Tenant A' : 'Tenant B', slug },
    });

    const existingKey = await prisma.tenantApiKey.findFirst({ where: { tenantId: tenant.id } });
    if (!existingKey) {
      const key = generateApiKey('test');
      await prisma.tenantApiKey.create({
        data: {
          tenantId: tenant.id,
          keyPrefix: key.prefix,
          keyHash: key.hash,
          scopes: ['verification-cases:write', 'verification-cases:read'],
        },
      });
      // Dev-only: the plaintext key is never recoverable after this, and
      // never stored — this is the one and only place it is printed.
      // eslint-disable-next-line no-console
      console.log(`${tenant.slug} API key: ${key.plaintext}`);
    }

    if (slug === 'tenant-a') {
      // otp_sms alone proves the subject controls a phone number, not that
      // any document backs their identity — SELF_ATTESTED is the honest
      // level for it.
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'standard' } },
        update: { claimType: 'IDENTITY', level: 'SELF_ATTESTED' },
        create: {
          tenantId: tenant.id,
          name: 'standard',
          methods: ['otp_sms'],
          claimType: 'IDENTITY',
          level: 'SELF_ATTESTED',
        },
      });

      // Phase 1: a real multi-method policy — otp_sms confirms the phone,
      // then document_ocr + liveness do the actual identity check. Order
      // matters: verification.workflow.ts runs methods.methods in array
      // order and stops at the first FAILED/NEEDS_REVIEW. document_ocr +
      // liveness together earn DOCUMENT_VERIFIED — no registry/sanctions
      // check exists yet, so nothing earns REGISTRY_VERIFIED for IDENTITY.
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'kyc' } },
        update: { claimType: 'IDENTITY', level: 'DOCUMENT_VERIFIED' },
        create: {
          tenantId: tenant.id,
          name: 'kyc',
          methods: ['otp_sms', 'document_ocr', 'liveness'],
          claimType: 'IDENTITY',
          level: 'DOCUMENT_VERIFIED',
        },
      });

      // Badges: one policy per (ClaimType, VerificationLevel) a tenant
      // wants to offer. DATE_OF_BIRTH has no registry-level policy — there's
      // no universal birth registry to check against; that's genuinely
      // country-specific national-ID-registry work (docs/PHASES.md Phase 2),
      // not a gap in this seed.
      const badgePolicies: Array<{
        name: string;
        methods: string[];
        claimType: 'DATE_OF_BIRTH' | 'EDUCATION' | 'EMPLOYMENT';
        level: 'DOCUMENT_VERIFIED' | 'REGISTRY_VERIFIED';
      }> = [
        { name: 'dob-document', methods: ['dob_document'], claimType: 'DATE_OF_BIRTH', level: 'DOCUMENT_VERIFIED' },
        {
          name: 'education-document',
          methods: ['education_document'],
          claimType: 'EDUCATION',
          level: 'DOCUMENT_VERIFIED',
        },
        {
          name: 'education-registry',
          methods: ['education_registry'],
          claimType: 'EDUCATION',
          level: 'REGISTRY_VERIFIED',
        },
        {
          name: 'employment-document',
          methods: ['employment_document'],
          claimType: 'EMPLOYMENT',
          level: 'DOCUMENT_VERIFIED',
        },
        {
          name: 'employment-registry',
          methods: ['employment_registry'],
          claimType: 'EMPLOYMENT',
          level: 'REGISTRY_VERIFIED',
        },
      ];
      for (const policy of badgePolicies) {
        await prisma.verificationPolicy.upsert({
          where: { tenantId_name: { tenantId: tenant.id, name: policy.name } },
          update: { claimType: policy.claimType, level: policy.level, methods: policy.methods },
          create: {
            tenantId: tenant.id,
            name: policy.name,
            methods: policy.methods,
            claimType: policy.claimType,
            level: policy.level,
          },
        });
      }

      // A demo relying-party client, for exercising "Login with nID"
      // (apps/login-ui) without a real RP app — its callback is just
      // something a curl/test script can read the code back from.
      const existingClient = await prisma.oAuthClient.findFirst({ where: { tenantId: tenant.id } });
      if (!existingClient) {
        const clientId = `client_test_${randomBytes(8).toString('hex')}`;
        const secret = generateSessionToken();
        await prisma.oAuthClient.create({
          data: {
            tenantId: tenant.id,
            name: 'Demo RP',
            clientId,
            clientSecretHash: sha256Hex(secret.plaintext),
            redirectUris: ['http://localhost:5000/callback'],
          },
        });
        // Dev-only: the plaintext secret is never recoverable after this,
        // and never stored — this is the one and only place it is printed.
        // eslint-disable-next-line no-console
        console.log(`${tenant.slug} OAuth client: ${clientId} / ${secret.plaintext}`);
      }
    }
  }

  await seedDemoProfile(prisma);

  await prisma.$disconnect();
}

/**
 * A demo public profile (docs/PHASES.md's profiles section) — an Account,
 * not a Tenant, since Profile is 1:1 with Account (schema.prisma's
 * comment). Also seeds one PhoneBadgeEvidence row so the profile shows a
 * real verified badge, demonstrating the whole point of the feature: a
 * person's public page benefits from KYC they completed with any tenant,
 * not just the one that ran the check — see badge-ranking.ts and
 * PhoneBadgeEvidence's schema comment. Safe to run more than once: every
 * step upserts or checks-then-creates by its own natural key.
 */
async function seedDemoProfile(prisma: ReturnType<typeof createPrismaClient>): Promise<void> {
  const phone = '+15550100001';

  const account = await prisma.account.upsert({
    where: { phone },
    update: {},
    create: { phone, phoneVerifiedAt: new Date() },
  });

  const profile = await prisma.profile.upsert({
    where: { accountId: account.id },
    update: {},
    create: {
      accountId: account.id,
      slug: 'demo-clinic',
      displayName: 'Dr. Amina Raza',
      headline: 'Family Physician & Wellness Coach',
      category: 'DOCTOR',
      bio: 'Board-certified family physician with 12 years of experience, focused on preventive care and long-term patient relationships.',
      phone,
      whatsapp: phone,
      publicEmail: 'hello@demo-clinic.example',
      addressLine1: '221B Baker Street',
      city: 'Springfield',
      region: 'IL',
      countryCode: 'US',
      latitude: 39.78,
      longitude: -89.65,
      timezone: 'America/Chicago',
      showPhone: true,
      showWhatsapp: true,
      showEmail: true,
      showAddress: true,
      showBadges: true,
      showBooking: true,
      showOffers: true,
      showHours: true,
      isPublished: true,
    },
  });

  if (!(await prisma.service.findFirst({ where: { profileId: profile.id, name: 'General Consultation' } }))) {
    await prisma.service.create({
      data: { profileId: profile.id, name: 'General Consultation', durationMinutes: 30, price: 40, currency: 'USD' },
    });
  }
  if (!(await prisma.service.findFirst({ where: { profileId: profile.id, name: 'Follow-up Visit' } }))) {
    await prisma.service.create({
      data: { profileId: profile.id, name: 'Follow-up Visit', durationMinutes: 15, price: 20, currency: 'USD' },
    });
  }

  const availabilityWindows: Array<{ day: 'MONDAY' | 'WEDNESDAY' | 'FRIDAY'; startMinute: number; endMinute: number }> = [
    { day: 'MONDAY', startMinute: 540, endMinute: 1020 },
    { day: 'WEDNESDAY', startMinute: 540, endMinute: 1020 },
    { day: 'FRIDAY', startMinute: 540, endMinute: 780 },
  ];
  for (const window of availabilityWindows) {
    const existing = await prisma.availabilityRule.findFirst({ where: { profileId: profile.id, day: window.day } });
    if (!existing) {
      await prisma.availabilityRule.create({ data: { profileId: profile.id, ...window } });
    }
  }

  const businessHours: Array<{ day: 'MONDAY' | 'WEDNESDAY' | 'FRIDAY' | 'SUNDAY'; openMinute?: number; closeMinute?: number; isClosed?: boolean }> = [
    { day: 'MONDAY', openMinute: 540, closeMinute: 1020 },
    { day: 'WEDNESDAY', openMinute: 540, closeMinute: 1020 },
    { day: 'FRIDAY', openMinute: 540, closeMinute: 780 },
    { day: 'SUNDAY', isClosed: true },
  ];
  for (const hour of businessHours) {
    await prisma.businessHour.upsert({
      where: { profileId_day: { profileId: profile.id, day: hour.day } },
      update: {},
      create: {
        profileId: profile.id,
        day: hour.day,
        openMinute: hour.openMinute,
        closeMinute: hour.closeMinute,
        isClosed: hour.isClosed ?? false,
      },
    });
  }

  if (!(await prisma.offer.findFirst({ where: { profileId: profile.id, title: 'New Patient Special' } }))) {
    await prisma.offer.create({
      data: { profileId: profile.id, title: 'New Patient Special', description: '20% off your first visit.' },
    });
  }

  if (!(await prisma.customLink.findFirst({ where: { profileId: profile.id, label: 'Patient Portal' } }))) {
    await prisma.customLink.create({
      data: { profileId: profile.id, label: 'Patient Portal', url: 'https://example.com/portal' },
    });
  }
  if (!(await prisma.socialLink.findFirst({ where: { profileId: profile.id, platform: 'INSTAGRAM' } }))) {
    await prisma.socialLink.create({
      data: { profileId: profile.id, platform: 'INSTAGRAM', url: 'https://instagram.com/democlinic' },
    });
  }

  // Real cross-tenant proof of the badge feature's whole point: this row
  // was never written by this profile's own account, it's what
  // resolveCaseActivity (apps/workflows) writes whenever ANY tenant's
  // VerificationCase for this phone resolves APPROVED.
  if (!(await prisma.phoneBadgeEvidence.findFirst({ where: { phone, claimType: 'IDENTITY' } }))) {
    await prisma.phoneBadgeEvidence.create({
      data: {
        phone,
        tenantId: 'tenant-a',
        subjectId: 'seed-demo-subject',
        caseId: 'seed-demo-case',
        claimType: 'IDENTITY',
        level: 'REGISTRY_VERIFIED',
        verifiedAt: new Date(),
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Demo profile: /${profile.slug} (account phone ${phone}, OTP dev-mode logs the code to this console)`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
