import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import type { Account } from '@nid/db';

export interface CreateAccessGrantDto {
  accountId: string;
  organizationId?: string;
  brandId?: string;
  accessType: 'OWNER' | 'PARTNER' | 'ADMIN' | 'MEMBER';
  partnershipPercentage?: number;
}

export interface UpdateAccessGrantDto {
  accessType?: 'OWNER' | 'PARTNER' | 'ADMIN' | 'MEMBER';
  partnershipPercentage?: number;
  status?: 'ACTIVE' | 'REVOKED' | 'PENDING';
}

export interface TransferOwnershipDto {
  newOwnerId: string;
  organizationId?: string;
  brandId?: string;
}

export interface AccessGrantInfo {
  id: string;
  accountId: string;
  tenantId: string;
  organizationId: string | null;
  brandId: string | null;
  accessType: string;
  partnershipPercentage: number | null;
  grantedBy: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  accountPhone: string | null;
  accountEmail: string | null;
}

@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
  ) {}

  /**
   * Grant access to an account at tenant/org/brand level.
   * The caller must be an OWNER or PARTNER of the tenant.
   */
  async createGrant(
    callerAccount: Account,
    tenantId: string,
    dto: CreateAccessGrantDto,
  ): Promise<AccessGrantInfo> {
    // Verify caller is owner or partner of the tenant
    const callerGrant = await this.prisma.unscoped.accessGrant.findFirst({
      where: {
        accountId: callerAccount.id,
        tenantId,
        accessType: { in: ['OWNER', 'PARTNER'] },
        status: 'ACTIVE',
      },
    });

    if (!callerGrant) {
      throw new ForbiddenException('Only tenant owners or partners can grant access.');
    }

    // Validate partnership percentage
    if (dto.accessType === 'PARTNER' && (dto.partnershipPercentage == null || dto.partnershipPercentage <= 0 || dto.partnershipPercentage > 100)) {
      throw new BadRequestException('Partnership percentage must be between 0 and 100 for PARTNER access type.');
    }

    // Prevent self-grant
    if (dto.accountId === callerAccount.id) {
      throw new BadRequestException('Cannot grant access to yourself.');
    }

    // Check for duplicate grant
    const existing = await this.prisma.unscoped.accessGrant.findUnique({
      where: {
        accountId_tenantId_organizationId_brandId: {
          accountId: dto.accountId,
          tenantId,
          organizationId: dto.organizationId ?? null,
          brandId: dto.brandId ?? null,
        },
      },
    });

    if (existing) {
      throw new ConflictException('This account already has an access grant at this scope.');
    }

    // Verify the target account exists
    const targetAccount = await this.prisma.unscoped.account.findUnique({
      where: { id: dto.accountId },
    });

    if (!targetAccount) {
      throw new NotFoundException('Target account not found.');
    }

    // If brand-level access, verify the brand belongs to the tenant
    if (dto.brandId) {
      const brand = await this.prisma.unscoped.brand.findUnique({
        where: { id: dto.brandId },
        include: {
          organization: {
            select: { tenantId: true },
          },
        },
      });

      if (!brand || brand.organization.tenantId !== tenantId) {
        throw new NotFoundException('Brand not found or does not belong to this tenant.');
      }

      // If no organization specified, infer from brand
      if (!dto.organizationId && brand.organization) {
        dto.organizationId = brand.organization.id;
      }
    }

    // If org-level access, verify the org belongs to the tenant
    if (dto.organizationId && !dto.brandId) {
      const org = await this.prisma.unscoped.organization.findFirst({
        where: { id: dto.organizationId, tenantId },
      });

      if (!org) {
        throw new NotFoundException('Organization not found or does not belong to this tenant.');
      }
    }

    const grant = await this.prisma.unscoped.accessGrant.create({
      data: {
        accountId: dto.accountId,
        tenantId,
        organizationId: dto.organizationId ?? null,
        brandId: dto.brandId ?? null,
        accessType: dto.accessType,
        partnershipPercentage: dto.partnershipPercentage ?? null,
        grantedBy: callerAccount.id,
        status: 'ACTIVE',
      },
      include: {
        account: {
          select: { phone: true, email: true },
        },
      },
    });

    // Emit webhook for Communicator sync
    await this.emitWebhookEvent(tenantId, 'access.grant.created', grant);

    return this.formatGrant(grant);
  }

  /**
   * List all access grants for a tenant/org/brand.
   */
  async listGrants(
    callerAccount: Account,
    tenantId: string,
    organizationId?: string,
    brandId?: string,
  ): Promise<AccessGrantInfo[]> {
    // Verify caller has access to the tenant
    const callerGrant = await this.prisma.unscoped.accessGrant.findFirst({
      where: {
        accountId: callerAccount.id,
        tenantId,
        status: 'ACTIVE',
      },
    });

    if (!callerGrant) {
      throw new ForbiddenException('You do not have access to this tenant.');
    }

    // Check if caller can view grants at the specified scope
    if (callerGrant.accessType !== 'OWNER' && callerGrant.accessType !== 'PARTNER') {
      // Non-owners can only view grants at their own scope or below
      if (organizationId && callerGrant.organizationId !== organizationId) {
        throw new ForbiddenException('You do not have permission to view grants at this scope.');
      }
    }

    const where = {
      tenantId,
      status: 'ACTIVE',
      ...(organizationId && { organizationId }),
      ...(brandId && { brandId }),
    };

    const grants = await this.prisma.unscoped.accessGrant.findMany({
      where,
      include: {
        account: {
          select: { phone: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return grants.map((g) => this.formatGrant(g));
  }

  /**
   * Get a single access grant by ID.
   */
  async getGrant(callerAccount: Account, tenantId: string, grantId: string): Promise<AccessGrantInfo> {
    const grant = await this.prisma.unscoped.accessGrant.findUnique({
      where: { id: grantId, tenantId },
      include: {
        account: {
          select: { phone: true, email: true },
        },
      },
    });

    if (!grant) {
      throw new NotFoundException('Access grant not found.');
    }

    // Verify caller has permission to view this grant
    const callerGrant = await this.prisma.unscoped.accessGrant.findFirst({
      where: {
        accountId: callerAccount.id,
        tenantId,
        accessType: { in: ['OWNER', 'PARTNER'] },
        status: 'ACTIVE',
      },
    });

    if (!callerGrant && grant.accountId !== callerAccount.id) {
      throw new ForbiddenException('You do not have permission to view this grant.');
    }

    return this.formatGrant(grant);
  }

  /**
   * Update an access grant.
   */
  async updateGrant(
    callerAccount: Account,
    tenantId: string,
    grantId: string,
    dto: UpdateAccessGrantDto,
  ): Promise<AccessGrantInfo> {
    const grant = await this.prisma.unscoped.accessGrant.findUnique({
      where: { id: grantId, tenantId },
    });

    if (!grant) {
      throw new NotFoundException('Access grant not found.');
    }

    // Only owners/partners can update grants
    const callerGrant = await this.prisma.unscoped.accessGrant.findFirst({
      where: {
        accountId: callerAccount.id,
        tenantId,
        accessType: { in: ['OWNER', 'PARTNER'] },
        status: 'ACTIVE',
      },
    });

    if (!callerGrant) {
      throw new ForbiddenException('Only tenant owners or partners can update access grants.');
    }

    // Prevent self-revocation
    if (dto.status === 'REVOKED' && grant.accountId === callerAccount.id) {
      throw new BadRequestException('You cannot revoke your own access.');
    }

    // Validate partnership percentage
    const newAccessType = dto.accessType ?? grant.accessType;
    if (newAccessType === 'PARTNER' && (dto.partnershipPercentage == null || dto.partnershipPercentage <= 0 || dto.partnershipPercentage > 100)) {
      throw new BadRequestException('Partnership percentage must be between 0 and 100 for PARTNER access type.');
    }

    const updated = await this.prisma.unscoped.accessGrant.update({
      where: { id: grantId },
      data: {
        ...(dto.accessType !== undefined && { accessType: dto.accessType }),
        ...(dto.partnershipPercentage !== undefined && { partnershipPercentage: dto.partnershipPercentage }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        account: {
          select: { phone: true, email: true },
        },
      },
    });

    // Emit webhook
    await this.emitWebhookEvent(tenantId, 'access.grant.updated', updated);

    return this.formatGrant(updated);
  }

  /**
   * Revoke an access grant.
   */
  async revokeGrant(
    callerAccount: Account,
    tenantId: string,
    grantId: string,
  ): Promise<{ message: string }> {
    const grant = await this.prisma.unscoped.accessGrant.findUnique({
      where: { id: grantId, tenantId },
    });

    if (!grant) {
      throw new NotFoundException('Access grant not found.');
    }

    // Only owners/partners can revoke
    const callerGrant = await this.prisma.unscoped.accessGrant.findFirst({
      where: {
        accountId: callerAccount.id,
        tenantId,
        accessType: { in: ['OWNER', 'PARTNER'] },
        status: 'ACTIVE',
      },
    });

    if (!callerGrant) {
      throw new ForbiddenException('Only tenant owners or partners can revoke access.');
    }

    // Prevent self-revocation
    if (grant.accountId === callerAccount.id) {
      throw new BadRequestException('You cannot revoke your own access.');
    }

    await this.prisma.unscoped.accessGrant.update({
      where: { id: grantId },
      data: { status: 'REVOKED' },
    });

    // Emit webhook
    await this.emitWebhookEvent(tenantId, 'access.grant.revoked', { id: grantId, accountId: grant.accountId });

    return { message: 'Access grant revoked.' };
  }

  /**
   * Transfer ownership to another account.
   * Only the current owner can transfer ownership.
   */
  async transferOwnership(
    callerAccount: Account,
    tenantId: string,
    dto: TransferOwnershipDto,
  ): Promise<{ message: string }> {
    // Verify caller is the owner
    const callerGrant = await this.prisma.unscoped.accessGrant.findFirst({
      where: {
        accountId: callerAccount.id,
        tenantId,
        accessType: 'OWNER',
        status: 'ACTIVE',
      },
    });

    if (!callerGrant) {
      throw new ForbiddenException('Only the tenant owner can transfer ownership.');
    }

    // Verify target account exists and has an active grant
    const targetGrant = await this.prisma.unscoped.accessGrant.findFirst({
      where: {
        accountId: dto.newOwnerId,
        tenantId,
        status: 'ACTIVE',
      },
    });

    if (!targetGrant) {
      throw new NotFoundException('Target account does not have an active access grant.');
    }

    // Update target to OWNER
    await this.prisma.unscoped.accessGrant.update({
      where: { id: targetGrant.id },
      data: { accessType: 'OWNER' },
    });

    // Downgrade caller to PARTNER or ADMIN
    await this.prisma.unscoped.accessGrant.update({
      where: { id: callerGrant.id },
      data: { accessType: 'PARTNER', partnershipPercentage: 0 },
    });

    // Emit webhook
    await this.emitWebhookEvent(tenantId, 'access.ownership.transferred', {
      fromAccountId: callerAccount.id,
      toAccountId: dto.newOwnerId,
    });

    return { message: 'Ownership transferred successfully.' };
  }

  /**
   * Add a partner with percentage-based ownership.
   */
  async addPartner(
    callerAccount: Account,
    tenantId: string,
    accountId: string,
    percentage: number,
  ): Promise<AccessGrantInfo> {
    if (percentage <= 0 || percentage > 100) {
      throw new BadRequestException('Partnership percentage must be between 0 and 100.');
    }

    // Verify caller is owner
    const callerGrant = await this.prisma.unscoped.accessGrant.findFirst({
      where: {
        accountId: callerAccount.id,
        tenantId,
        accessType: 'OWNER',
        status: 'ACTIVE',
      },
    });

    if (!callerGrant) {
      throw new ForbiddenException('Only the tenant owner can add partners.');
    }

    // Check for existing grant
    const existing = await this.prisma.unscoped.accessGrant.findUnique({
      where: {
        accountId_tenantId_organizationId_brandId: {
          accountId,
          tenantId,
          organizationId: null,
          brandId: null,
        },
      },
    });

    if (existing) {
      // Update existing grant to PARTNER
      const updated = await this.prisma.unscoped.accessGrant.update({
        where: { id: existing.id },
        data: { accessType: 'PARTNER', partnershipPercentage: percentage },
        include: {
          account: {
            select: { phone: true, email: true },
          },
        },
      });

      await this.emitWebhookEvent(tenantId, 'access.partner.added', updated);
      return this.formatGrant(updated);
    }

    // Create new partner grant
    const grant = await this.prisma.unscoped.accessGrant.create({
      data: {
        accountId,
        tenantId,
        accessType: 'PARTNER',
        partnershipPercentage: percentage,
        grantedBy: callerAccount.id,
        status: 'ACTIVE',
      },
      include: {
        account: {
          select: { phone: true, email: true },
        },
      },
    });

    await this.emitWebhookEvent(tenantId, 'access.partner.added', grant);
    return this.formatGrant(grant);
  }

  /**
   * Get effective permissions for the current user at a given scope.
   */
  async getMyPermissions(
    callerAccount: Account,
    tenantId: string,
    organizationId?: string,
    brandId?: string,
  ): Promise<{ permissions: string[]; accessType: string; departments: string[]; roles: string[] }> {
    // Get access grant
    const grant = await this.prisma.unscoped.accessGrant.findFirst({
      where: {
        accountId: callerAccount.id,
        tenantId,
        status: 'ACTIVE',
        ...(organizationId && { organizationId }),
        ...(brandId && { brandId }),
      },
    });

    if (!grant) {
      // Check for broader scope grants (tenant-level covers org/brand)
      const broaderGrant = await this.prisma.unscoped.accessGrant.findFirst({
        where: {
          accountId: callerAccount.id,
          tenantId,
          status: 'ACTIVE',
          organizationId: null,
          brandId: null,
        },
      });

      if (!broaderGrant) {
        return { permissions: [], accessType: 'none', departments: [], roles: [] };
      }
    }

    // Get department assignments
    const deptAssignments = await this.prisma.unscoped.departmentAssignment.findMany({
      where: {
        accountId: callerAccount.id,
        tenantId,
        ...(organizationId && { organizationId }),
        ...(brandId && { brandId }),
      },
      include: {
        department: {
          select: { name: true, slug: true, defaultPermissions: true },
        },
      },
    });

    // Get role assignments
    const roleAssignments = await this.prisma.unscoped.roleAssignment.findMany({
      where: {
        accountId: callerAccount.id,
        tenantId,
        ...(organizationId && { organizationId }),
        ...(brandId && { brandId }),
      },
      include: {
        roleDefinition: {
          select: { name: true, slug: true, permissions: true },
        },
      },
    });

    // Collect all permissions from roles and departments
    const permissions = new Set<string>();

    // Owner/partner gets all permissions
    const effectiveGrant = grant || (await this.prisma.unscoped.accessGrant.findFirst({
      where: {
        accountId: callerAccount.id,
        tenantId,
        status: 'ACTIVE',
        organizationId: null,
        brandId: null,
      },
    }));

    if (effectiveGrant?.accessType === 'OWNER' || effectiveGrant?.accessType === 'PARTNER') {
      // Add all permissions from catalog
      const catalog = await this.prisma.unscoped.permissionCatalog.findMany({
        select: { permissionKey: true },
      });
      catalog.forEach((c) => permissions.add(c.permissionKey));
    } else {
      // Collect from roles
      roleAssignments.forEach((ra) => {
        const perms = ra.roleDefinition.permissions as string[];
        if (Array.isArray(perms)) {
          perms.forEach((p) => permissions.add(p));
        }
      });

      // Collect from departments
      deptAssignments.forEach((da) => {
        const perms = da.department.defaultPermissions as string[];
        if (Array.isArray(perms)) {
          perms.forEach((p) => permissions.add(p));
        }
      });
    }

    return {
      permissions: Array.from(permissions),
      accessType: effectiveGrant?.accessType ?? 'none',
      departments: deptAssignments.map((da) => da.department.slug),
      roles: roleAssignments.map((ra) => ra.roleDefinition.slug),
    };
  }

  private formatGrant(grant: any): AccessGrantInfo {
    return {
      id: grant.id,
      accountId: grant.accountId,
      tenantId: grant.tenantId,
      organizationId: grant.organizationId,
      brandId: grant.brandId,
      accessType: grant.accessType,
      partnershipPercentage: grant.partnershipPercentage,
      grantedBy: grant.grantedBy,
      status: grant.status,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
      accountPhone: grant.account?.phone ?? null,
      accountEmail: grant.account?.email ?? null,
    };
  }

  private async emitWebhookEvent(tenantId: string, eventType: string, data: unknown) {
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id: tenantId },
      select: { webhookUrl: true, webhookSecretPlaintext: true },
    });

    if (!tenant?.webhookUrl || !tenant.webhookSecretPlaintext) {
      return;
    }

    const payloadObj = {
      event_type: eventType,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
      data,
    };
    const payload = JSON.stringify(payloadObj);

    const crypto = await import('node:crypto');
    const signature = crypto
      .default.createHmac('sha256', tenant.webhookSecretPlaintext)
      .update(payload)
      .digest('hex');

    const outboundEvent = await this.prisma.unscoped.outboundEvent.create({
      data: {
        tenantId,
        eventType,
        payload: payloadObj,
        targetUrl: tenant.webhookUrl,
        status: 'PENDING',
        attempts: 0,
      },
    });

    // Fire-and-forget delivery
    this.deliverWebhook(outboundEvent.id, tenant.webhookUrl, payload, signature).catch((err) => {
      console.error(`Webhook delivery failed for tenant ${tenantId}:`, err);
    });
  }

  private async deliverWebhook(
    outboundEventId: string,
    url: string,
    payload: string,
    signature: string,
  ): Promise<void> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': 'nid_access',
          },
          body: payload,
        });

        if (response.ok) {
          await this.prisma.unscoped.outboundEvent.update({
            where: { id: outboundEventId },
            data: { status: 'DELIVERED', deliveredAt: new Date(), attempts },
          });
          return;
        }

        // Retry on 5xx errors
        if (response.status >= 500) {
          await this.prisma.unscoped.outboundEvent.update({
            where: { id: outboundEventId },
            data: { attempts, lastError: `HTTP ${response.status}` },
          });
          await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
          continue;
        }

        // Non-retryable error
        await this.prisma.unscoped.outboundEvent.update({
          where: { id: outboundEventId },
          data: { status: 'FAILED', attempts, lastError: `HTTP ${response.status}` },
        });
        return;
      } catch (err: any) {
        await this.prisma.unscoped.outboundEvent.update({
          where: { id: outboundEventId },
          data: { attempts, lastError: err.message },
        });
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      }
    }

    await this.prisma.unscoped.outboundEvent.update({
      where: { id: outboundEventId },
      data: { status: 'FAILED', lastError: 'Max retries exceeded' },
    });
  }
}
