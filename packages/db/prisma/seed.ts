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

    // A real staff Account for apps/dashboard's phone+OTP login — the same
    // portable Account every other "a person signs into something" flow
    // uses, not a placeholder. Exercises TenantStaffMembership end to end
    // without needing a real invite call first.
    const staffPhone = slug === 'tenant-a' ? '+15550200001' : '+15550200002';
    const staffAccount = await prisma.account.upsert({
      where: { phone: staffPhone },
      update: {},
      create: { phone: staffPhone, phoneVerifiedAt: new Date() },
    });
    await prisma.tenantStaffMembership.upsert({
      where: { tenantId_accountId: { tenantId: tenant.id, accountId: staffAccount.id } },
      update: {},
      create: { tenantId: tenant.id, accountId: staffAccount.id, role: 'STAFF' },
    });
    // eslint-disable-next-line no-console
    console.log(`${tenant.slug} dashboard staff login: ${staffPhone} (phone+OTP, dev mode logs the code)`);

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
      // liveness together earn DOCUMENT_VERIFIED.
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

      // IDENTITY's REGISTRY_VERIFIED slot: a bank confirming its own
      // records for an account (`referenceId`) name the subject's claimed
      // `accountTitle` — an authoritative third-party source, same
      // REGISTRY_VERIFIED reasoning as education_registry/
      // employment_registry below, just for IDENTITY instead of a
      // separate claim.
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'bank-account-title' } },
        update: { claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED' },
        create: {
          tenantId: tenant.id,
          name: 'bank-account-title',
          methods: ['bank_account_title'],
          claimType: 'IDENTITY',
          level: 'REGISTRY_VERIFIED',
        },
      });

      // IDENTITY's other REGISTRY_VERIFIED path: a Pakistani provincial
      // e-stamping authority/bank confirming a claimed phone number is the
      // one on file against a claimed CNIC (`referenceId`) — real
      // third-party evidence, same reasoning as bank-account-title above,
      // just tying NAME + NATIONAL_ID_NUMBER + PHONE together at once (see
      // method-attributes.ts).
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'estamp-registry' } },
        update: { claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED' },
        create: {
          tenantId: tenant.id,
          name: 'estamp-registry',
          methods: ['estamp_registry'],
          claimType: 'IDENTITY',
          level: 'REGISTRY_VERIFIED',
        },
      });

      // A DOCUMENT_VERIFIED-level IDENTITY policy, not REGISTRY_VERIFIED:
      // this method never queries ECP itself (no institutional API exists —
      // see SelfReportedCheckProvider's header comment), it only carries a
      // human reviewer's judgment on the subject's self-report. Same honest
      // ceiling document_ocr's own human-in-the-loop path can reach, not
      // the stronger claim an actual registry API call would earn.
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'ecp-voter-registration' } },
        update: { claimType: 'IDENTITY', level: 'DOCUMENT_VERIFIED' },
        create: {
          tenantId: tenant.id,
          name: 'ecp-voter-registration',
          methods: ['ecp_voter_registration'],
          claimType: 'IDENTITY',
          level: 'DOCUMENT_VERIFIED',
        },
      });

      // Inheriting a badge from a verified Organization one already belongs
      // to (org_membership) — DOCUMENT_VERIFIED, not REGISTRY_VERIFIED: the
      // policy's declared level is fixed and denormalized onto every case
      // at creation (see VerificationCase.level's schema comment), so it
      // can't dynamically match whatever level the Organization's own KYB
      // case actually earned — DOCUMENT_VERIFIED is the honest floor for
      // "a real, DB-enforced check ran," same ceiling ecp-voter-registration
      // above settles for when the underlying proof can vary in strength.
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'org-membership' } },
        update: { claimType: 'IDENTITY', level: 'DOCUMENT_VERIFIED' },
        create: {
          tenantId: tenant.id,
          name: 'org-membership',
          methods: ['org_membership'],
          claimType: 'IDENTITY',
          level: 'DOCUMENT_VERIFIED',
        },
      });

      // An agent physically inspecting original documents — real evidence
      // from an authenticated tenant actor, the same DOCUMENT_VERIFIED tier
      // document_ocr earns, just captured in person instead of via OCR.
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'agent-in-person-document' } },
        update: { claimType: 'IDENTITY', level: 'DOCUMENT_VERIFIED' },
        create: {
          tenantId: tenant.id,
          name: 'agent-in-person-document',
          methods: ['agent_in_person_document'],
          claimType: 'IDENTITY',
          level: 'DOCUMENT_VERIFIED',
        },
      });

      // The three address-verification methods — each earns the real
      // ADDRESS attribute badge (VerifiedAttribute, via method-attributes.ts)
      // independent of whichever ClaimType/level this policy itself
      // declares (that coarse pair predates attribute-level badges and has
      // no ADDRESS value of its own — IDENTITY is the closest real-world
      // fit, the same category proof-of-address documents fall under in
      // standard KYC).
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'address-gps-match' } },
        update: { claimType: 'IDENTITY', level: 'DOCUMENT_VERIFIED' },
        create: {
          tenantId: tenant.id,
          name: 'address-gps-match',
          methods: ['address_gps_match'],
          claimType: 'IDENTITY',
          level: 'DOCUMENT_VERIFIED',
        },
      });
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'address-utility-bill' } },
        update: { claimType: 'IDENTITY', level: 'DOCUMENT_VERIFIED' },
        create: {
          tenantId: tenant.id,
          name: 'address-utility-bill',
          methods: ['address_utility_bill'],
          claimType: 'IDENTITY',
          level: 'DOCUMENT_VERIFIED',
        },
      });
      // The strongest of the three — physical mail delivery to the claimed
      // address is a real third-party (the postal system) attesting it's
      // real and reachable, same reasoning method-attributes.ts gives it
      // REGISTRY_VERIFIED at the attribute level too.
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'address-postal-otp' } },
        update: { claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED' },
        create: {
          tenantId: tenant.id,
          name: 'address-postal-otp',
          methods: ['address_postal_otp'],
          claimType: 'IDENTITY',
          level: 'REGISTRY_VERIFIED',
        },
      });

      // KYB: verifying the Organization itself, not a person's membership
      // in one (org-membership, above, is the consumer side of this — it
      // requires an already-APPROVED IDENTITY case on the Organization's
      // own Subject, which only these two policies can ever produce for
      // real). Both are ORGANIZATION-only — see method-subject-types.ts —
      // so VerificationCasesService.create() rejects either one run
      // against a PERSON Subject.
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'org-kyb-document' } },
        update: { claimType: 'IDENTITY', level: 'DOCUMENT_VERIFIED' },
        create: {
          tenantId: tenant.id,
          name: 'org-kyb-document',
          methods: ['business_registration_document'],
          claimType: 'IDENTITY',
          level: 'DOCUMENT_VERIFIED',
        },
      });
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'org-kyb-registry' } },
        update: { claimType: 'IDENTITY', level: 'REGISTRY_VERIFIED' },
        create: {
          tenantId: tenant.id,
          name: 'org-kyb-registry',
          methods: ['business_registry'],
          claimType: 'IDENTITY',
          level: 'REGISTRY_VERIFIED',
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

  await seedNmailClient(prisma);
  await seedErpClient(prisma);
  await seedDemoProfile(prisma);

  await prisma.$disconnect();
}

/**
 * The real "Login with nID" relying-party registration for nmail (the
 * Newax mail product) -- distinct from the tenant-a Demo RP client above,
 * which exists only for curl-testing the OAuth flow without a real app.
 * nmail is nID's first actual integration: one nID Account is the single
 * identity behind both a person's one personal mailbox and any number of
 * work mailboxes a domain owner assigns them, across any org -- see
 * nmail's user_auth.go / nid_auth.go for the RP-side half of this flow.
 * NMAIL_OAUTH_REDIRECT_URI lets this match whatever host nmail's own
 * callback actually runs on; safe to run more than once (idempotent by
 * tenant slug, and never rotates an already-created client's secret).
 */
async function seedNmailClient(prisma: ReturnType<typeof createPrismaClient>): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'nmail' },
    update: {},
    create: { name: 'nmail', slug: 'nmail' },
  });

  const existingClient = await prisma.oAuthClient.findFirst({ where: { tenantId: tenant.id } });
  if (existingClient) {
    // eslint-disable-next-line no-console
    console.log(`nmail OAuth client already seeded: ${existingClient.clientId} (secret not re-printed; rotate by deleting the row if lost)`);
    return;
  }

  const redirectUri = process.env.NMAIL_OAUTH_REDIRECT_URI ?? 'http://localhost:8081/api/users/login/nid/callback';
  const clientId = `client_nmail_${randomBytes(8).toString('hex')}`;
  const secret = generateSessionToken();
  await prisma.oAuthClient.create({
    data: {
      tenantId: tenant.id,
      name: 'nmail',
      clientId,
      clientSecretHash: sha256Hex(secret.plaintext),
      redirectUris: [redirectUri],
    },
  });
  // Dev-only: the plaintext secret is never recoverable after this, and
  // never stored -- this is the one and only place it is printed. Put
  // these in nmail's NID_CLIENT_ID / NID_CLIENT_SECRET env vars.
  // eslint-disable-next-line no-console
  console.log(`nmail OAuth client: ${clientId} / ${secret.plaintext} (redirect: ${redirectUri})`);
}

/**
 * The real "Login with nID" relying-party registration for erp-1 (Yaseen Business Platform)
 * as specified in ECOSYSTEM.md ("nID is the single identity provider for the whole ecosystem").
 * ERP_OAUTH_REDIRECT_URI lets this match the callback on erp-1 (defaults to http://localhost:3001/api/v1/auth/sso/nid/callback).
 * Supports enterprise multi-tenancy — multiple organizations using erp-1 authenticate via nID accounts.
 */
async function seedErpClient(prisma: ReturnType<typeof createPrismaClient>): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'erp-1' },
    update: {},
    create: { name: 'erp-1 (Yaseen Business Platform)', slug: 'erp-1' },
  });

  const existingClient = await prisma.oAuthClient.findFirst({ where: { tenantId: tenant.id } });
  if (existingClient) {
    // eslint-disable-next-line no-console
    console.log(`erp-1 OAuth client already seeded: ${existingClient.clientId} (secret not re-printed; rotate by deleting the row if lost)`);
    return;
  }

  const redirectUri = process.env.ERP_OAUTH_REDIRECT_URI ?? 'http://localhost:3001/api/v1/auth/sso/nid/callback';
  const clientId = `client_erp_${randomBytes(8).toString('hex')}`;
  const secret = generateSessionToken();
  await prisma.oAuthClient.create({
    data: {
      tenantId: tenant.id,
      name: 'erp-1 (Yaseen)',
      clientId,
      clientSecretHash: sha256Hex(secret.plaintext),
      redirectUris: [redirectUri],
    },
  });
  // eslint-disable-next-line no-console
  console.log(`erp-1 OAuth client: ${clientId} / ${secret.plaintext} (redirect: ${redirectUri})`);
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
