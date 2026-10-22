import { Module } from '@nestjs/common';
import { CrossTenantBadgesService } from './cross-tenant-badges.service';

@Module({
  providers: [CrossTenantBadgesService],
  exports: [CrossTenantBadgesService],
})
export class BadgesModule {}
