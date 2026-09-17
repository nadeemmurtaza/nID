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

  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
