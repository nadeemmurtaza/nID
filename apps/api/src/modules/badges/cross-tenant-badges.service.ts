import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { pickStrongestPerClaimType, type Badge, type RankableEvidence } from './badge-ranking';

/**
 * A Profile's badges: every PhoneBadgeEvidence row for this phone, across
 * every tenant that ever ran a case against it — see schema.prisma's
 * PhoneBadgeEvidence comment for why this reads a denormalized evidence
 * table instead of joining Subject/VerificationCase across tenants.
 * PhoneBadgeEvidence carries no RLS policy (same trust domain as Account),
 * so `unscoped` is correct here, not a bug — mirrors AccountsService's own
 * use of `unscoped` for Account/AccountSession/AccountOtpCode.
 */
@Injectable()
export class CrossTenantBadgesService {
  constructor(private readonly prisma: PrismaService) {}

  async getBadgesForPhone(phone: string): Promise<Badge[]> {
    const evidence = await this.prisma.unscoped.phoneBadgeEvidence.findMany({
      where: { phone },
      orderBy: [{ level: 'desc' }, { verifiedAt: 'desc' }],
      select: { claimType: true, level: true, verifiedAt: true, caseId: true },
    });

    const rankable: RankableEvidence[] = evidence.map((row) => ({
      claimType: row.claimType,
      level: row.level,
      verifiedAt: row.verifiedAt,
      caseId: row.caseId,
    }));

    return pickStrongestPerClaimType(rankable);
  }
}
