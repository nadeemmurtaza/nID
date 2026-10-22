import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import type { ActorType } from '../../core/auth/types';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSelf(tenantId: string, actorType: ActorType) {
    const tenant = await this.prisma.forTenant(tenantId, (tx) =>
      tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, dataResidencyRegion: true, createdAt: true },
      }),
    );
    // apps/dashboard uses this to tell its own login screen a session
    // signed in as staff apart from one that pasted a raw API key.
    return { ...tenant, signedInAs: actorType };
  }
}
