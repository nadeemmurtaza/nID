import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import type { InviteStaffDto } from './dto/invite-staff.dto';

/**
 * Invites a real Account onto a Tenant's staff — the write side of
 * TenantStaffMembership (see its own schema comment). Only ever called
 * with a tenant API key (inviting staff is a tenant-admin action, not
 * something staff do to themselves), so `apiKeyId` here is genuinely
 * always an API key, unlike VerificationCasesService's list/getById/
 * resolveCase, which TenantActorGuard also lets a staff session reach.
 */
@Injectable()
export class TenantStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async invite(tenantId: string, apiKeyId: string, dto: InviteStaffDto) {
    const account = await this.prisma.unscoped.account.findUnique({ where: { phone: dto.phone } });
    if (!account) {
      throw new NotFoundException(
        `No nID account exists for ${dto.phone} yet — ask them to sign in once at apps/login-ui ` +
          `or apps/profile-ui first, then invite them.`,
      );
    }

    return this.prisma.forTenant(tenantId, async (tx) => {
      const membership = await tx.tenantStaffMembership.upsert({
        where: { tenantId_accountId: { tenantId, accountId: account.id } },
        update: { role: dto.role ?? 'STAFF' },
        create: { tenantId, accountId: account.id, role: dto.role ?? 'STAFF' },
      });

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'tenant_staff.invite',
      });

      return { ...membership, phone: account.phone };
    });
  }

  async list(tenantId: string, apiKeyId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const memberships = await tx.tenantStaffMembership.findMany({ orderBy: { createdAt: 'asc' } });
      const accounts = await this.prisma.unscoped.account.findMany({
        where: { id: { in: memberships.map((m) => m.accountId) } },
      });
      const phoneByAccountId = new Map(accounts.map((a) => [a.id, a.phone]));

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'tenant_staff.list',
      });

      return memberships.map((m) => ({ ...m, phone: phoneByAccountId.get(m.accountId) ?? null }));
    });
  }
}
