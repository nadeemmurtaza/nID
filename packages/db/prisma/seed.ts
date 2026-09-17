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
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'standard' } },
        update: {},
        create: {
          tenantId: tenant.id,
          name: 'standard',
          methods: ['otp_sms'],
        },
      });

      // Phase 1: a real multi-method policy — otp_sms confirms the phone,
      // then document_ocr + liveness do the actual identity check. Order
      // matters: verification.workflow.ts runs methods.methods in array
      // order and stops at the first FAILED/NEEDS_REVIEW.
      await prisma.verificationPolicy.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'kyc' } },
        update: {},
        create: {
          tenantId: tenant.id,
          name: 'kyc',
          methods: ['otp_sms', 'document_ocr', 'liveness'],
        },
      });

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
