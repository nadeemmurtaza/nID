import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSelf(tenantId: string) {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, dataResidencyRegion: true, createdAt: true },
      }),
    );
  }
}
