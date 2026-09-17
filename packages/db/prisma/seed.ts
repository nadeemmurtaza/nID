import { generateApiKey } from '@nid/shared-types';
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
    }
  }

  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
