import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import type { Account } from '@nid/db';
import { Prisma } from '@nid/db';

export interface CreateRoleDto {
  name: string;
  slug?: string;
  description?: string;
  permissions: string[];
}

export interface UpdateRoleDto {
  name?: string;
  slug?: string;
  description?: string;
  permissions?: string[];
}

export interface AssignRoleDto {
  accountId: string;
  organizationId?: string;
  brandId?: string;
  scope?: 'TENANT' | 'ORGANIZATION' | 'BRAND';
}

export interface RoleInfo {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  assignmentCount: number;
}

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a custom role definition.
   */
  async createRole(
    callerAccount: Account,
    tenantId: string,
    dto: CreateRoleDto,
  ): Promise<RoleInfo> {
    await this.requireOwnerOrPartner(callerAccount, tenantId);

    const slug = dto.slug || this.slugify(dto.name);

    const existing = await this.prisma.unscoped.roleDefinition.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });

    if (existing) {
      throw new ConflictException(`A role with slug "${slug}" already exists.`);
    }

    const role = await this.prisma.unscoped.roleDefinition.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        permissions: dto.permissions as any,
        isSystem: false,
      },
    });

    await this.emitWebhookEvent(tenantId, 'role.created', role);
    return this.formatRole(role, 0);
  }

  /**
   * List all roles for a tenant.
   */
  async listRoles(callerAccount: Account, tenantId: string): Promise<RoleInfo[]> {
    await this.requireAccess(callerAccount, tenantId);

    const roles = await this.prisma.unscoped.roleDefinition.findMany({
      where: { tenantId },
      orderBy: { isSystem: 'asc', name: 'asc' },
    });

    const results = await Promise.all(
      roles.map(async (role) => {
        const count = await this.prisma.unscoped.roleAssignment.count({
          where: { roleDefinitionId: role.id },
        });
        return this.formatRole(role, count);
      }),
    );

    return results;
  }

  /**
   * Get a single role.
   */
  async getRole(
    callerAccount: Account,
    tenantId: string,
    roleId: string,
  ): Promise<RoleInfo> {
    await this.requireAccess(callerAccount, tenantId);

    const role = await this.prisma.unscoped.roleDefinition.findUnique({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    const count = await this.prisma.unscoped.roleAssignment.count({
      where: { roleDefinitionId: role.id },
    });

    return this.formatRole(role, count);
  }

  /**
   * Update a role (custom roles only).
   */
  async updateRole(
    callerAccount: Account,
    tenantId: string,
    roleId: string,
    dto: UpdateRoleDto,
  ): Promise<RoleInfo> {
    await this.requireOwnerOrPartner(callerAccount, tenantId);

    const role = await this.prisma.unscoped.roleDefinition.findUnique({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    if (role.isSystem) {
      throw new BadRequestException('Built-in roles cannot be modified.');
    }

    let newSlug = dto.slug ?? role.slug;
    if (dto.slug && dto.slug !== role.slug) {
      const existing = await this.prisma.unscoped.roleDefinition.findUnique({
        where: { tenantId_slug: { tenantId, slug: dto.slug } },
      });
      if (existing) {
        throw new ConflictException(`A role with slug "${dto.slug}" already exists.`);
      }
    }

    const updated = await this.prisma.unscoped.roleDefinition.update({
      where: { id: roleId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: newSlug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions as any }),
      },
    });

    await this.emitWebhookEvent(tenantId, 'role.updated', updated);

    const count = await this.prisma.unscoped.roleAssignment.count({
      where: { roleDefinitionId: updated.id },
    });

    return this.formatRole(updated, count);
  }

  /**
   * Delete a custom role.
   */
  async deleteRole(
    callerAccount: Account,
    tenantId: string,
    roleId: string,
  ): Promise<{ message: string }> {
    await this.requireOwnerOrPartner(callerAccount, tenantId);

    const role = await this.prisma.unscoped.roleDefinition.findUnique({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    if (role.isSystem) {
      throw new BadRequestException('Built-in roles cannot be deleted.');
    }

    // Remove all assignments first
    await this.prisma.unscoped.roleAssignment.deleteMany({
      where: { roleDefinitionId: roleId },
    });

    await this.prisma.unscoped.roleDefinition.delete({
      where: { id: roleId },
    });

    await this.emitWebhookEvent(tenantId, 'role.deleted', { id: roleId, slug: role.slug });

    return { message: 'Role deleted.' };
  }

  /**
   * Assign a role to an account.
   */
  async assignRole(
    callerAccount: Account,
    tenantId: string,
    roleId: string,
    dto: AssignRoleDto,
  ): Promise<{ message: string }> {
    await this.requireOwnerOrPartner(callerAccount, tenantId);

    const role = await this.prisma.unscoped.roleDefinition.findUnique({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    const account = await this.prisma.unscoped.account.findUnique({
      where: { id: dto.accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found.');
    }

    const scope = dto.scope || (dto.brandId ? 'BRAND' : dto.organizationId ? 'ORGANIZATION' : 'TENANT');

    const existing = await this.prisma.unscoped.roleAssignment.findUnique({
      where: {
        accountId_roleDefinitionId_scope_organizationId_brandId: {
          accountId: dto.accountId,
          roleDefinitionId: roleId,
          scope,
          organizationId: dto.organizationId ?? undefined,
          brandId: dto.brandId ?? undefined,
        },
      } as any,
    });

    if (existing) {
      throw new ConflictException('This account already has this role at this scope.');
    }

    await this.prisma.unscoped.roleAssignment.create({
      data: {
        accountId: dto.accountId,
        roleDefinitionId: roleId,
        tenantId,
        organizationId: dto.organizationId ?? null,
        brandId: dto.brandId ?? null,
        scope,
      },
    });

    await this.emitWebhookEvent(tenantId, 'role.assigned', {
      roleDefinitionId: roleId,
      accountId: dto.accountId,
      scope,
    });

    return { message: 'Role assigned.' };
  }

  /**
   * Remove a role assignment.
   */
  async removeRoleAssignment(
    callerAccount: Account,
    tenantId: string,
    roleId: string,
    accountId: string,
  ): Promise<{ message: string }> {
    await this.requireOwnerOrPartner(callerAccount, tenantId);

    await this.prisma.unscoped.roleAssignment.deleteMany({
      where: { roleDefinitionId: roleId, accountId, tenantId },
    });

    await this.emitWebhookEvent(tenantId, 'role.unassigned', {
      roleDefinitionId: roleId,
      accountId,
    });

    return { message: 'Role assignment removed.' };
  }

  /**
   * Get role assignments for an account.
   */
  async getAccountRoles(
    callerAccount: Account,
    tenantId: string,
    accountId: string,
  ): Promise<any[]> {
    await this.requireAccess(callerAccount, tenantId);

    const assignments = await this.prisma.unscoped.roleAssignment.findMany({
      where: { accountId, tenantId },
      include: {
        role: {
          select: { id: true, name: true, slug: true, permissions: true, isSystem: true },
        },
      },
    });

    return assignments.map((a) => ({
      roleId: a.roleDefinitionId,
      roleName: a.role.name,
      roleSlug: a.role.slug,
      permissions: a.role.permissions as any,
      isSystem: a.role.isSystem,
      scope: a.scope,
      organizationId: a.organizationId,
      brandId: a.brandId,
    }));
  }

  /**
   * Seed built-in roles for a tenant.
   */
  async seedBuiltInRoles(tenantId: string): Promise<void> {
    const builtInRoles = [
      {
        name: 'Super Admin',
        slug: 'super-admin',
        description: 'Full access to all features across all entities',
        permissions: ['*'],
      },
      {
        name: 'Inbox Manager',
        slug: 'inbox-manager',
        description: 'Full access to inbox services',
        permissions: [
          'inbox:omni-inbox:view', 'inbox:omni-inbox:reply', 'inbox:omni-inbox:assign', 'inbox:omni-inbox:notes',
          'inbox:whatsapp-inbox:view', 'inbox:whatsapp-inbox:reply',
          'inbox:sms-inbox:view', 'inbox:sms-inbox:reply',
          'inbox:email-inbox:view', 'inbox:email-inbox:reply',
        ],
      },
      {
        name: 'Campaign Manager',
        slug: 'campaign-manager',
        description: 'Full access to campaigns and broadcasts',
        permissions: [
          'campaigns:omni-broadcast:view', 'campaigns:omni-broadcast:create', 'campaigns:omni-broadcast:send',
          'campaigns:omni-broadcast:edit', 'campaigns:omni-broadcast:delete', 'campaigns:omni-broadcast:analytics',
        ],
      },
      {
        name: 'Commerce Manager',
        slug: 'commerce-manager',
        description: 'Full access to commerce services',
        permissions: [
          'commerce:catalog:view', 'commerce:catalog:edit', 'commerce:catalog:delete',
          'commerce:orders:view', 'commerce:orders:edit', 'commerce:orders:process',
          'commerce:payments:view', 'commerce:payments:process',
        ],
      },
      {
        name: 'CRM Manager',
        slug: 'crm-manager',
        description: 'Full access to CRM services',
        permissions: [
          'crm:contacts:view', 'crm:contacts:edit', 'crm:contacts:delete', 'crm:contacts:import', 'crm:contacts:export',
          'crm:client-profiles:view', 'crm:client-profiles:edit',
        ],
      },
      {
        name: 'Analytics Viewer',
        slug: 'analytics-viewer',
        description: 'Read-only access to analytics and reports',
        permissions: [
          'analytics:reports:view', 'analytics:reports:export',
          'analytics:unified-analytics:view',
        ],
      },
      {
        name: 'Support Agent',
        slug: 'support-agent',
        description: 'Basic support access with inbox and CRM',
        permissions: [
          'inbox:omni-inbox:view', 'inbox:omni-inbox:reply', 'inbox:omni-inbox:notes',
          'crm:contacts:view', 'crm:client-profiles:view',
        ],
      },
    ];

    for (const role of builtInRoles) {
      await this.prisma.unscoped.roleDefinition.upsert({
        where: { tenantId_slug: { tenantId, slug: role.slug } },
        update: {},
        create: {
          tenantId,
          name: role.name,
          slug: role.slug,
          description: role.description,
          permissions: role.permissions as any,
          isSystem: true,
        },
      });
    }
  }

  private async requireOwnerOrPartner(account: Account, tenantId: string) {
    const grant = await this.prisma.unscoped.accessGrant.findFirst({
      where: {
        accountId: account.id,
        tenantId,
        accessType: { in: ['OWNER', 'PARTNER'] },
        status: 'ACTIVE',
      },
    });

    if (!grant) {
      throw new ForbiddenException('Only tenant owners or partners can perform this action.');
    }
  }

  private async requireAccess(account: Account, tenantId: string) {
    const grant = await this.prisma.unscoped.accessGrant.findFirst({
      where: {
        accountId: account.id,
        tenantId,
        status: 'ACTIVE',
      },
    });

    if (!grant) {
      throw new ForbiddenException('You do not have access to this tenant.');
    }
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private formatRole(role: any, assignmentCount: number): RoleInfo {
    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      slug: role.slug,
      description: role.description,
      permissions: role.permissions as any,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      assignmentCount,
    };
  }

  private async emitWebhookEvent(tenantId: string, eventType: string, data: unknown) {
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id: tenantId },
      select: { webhookUrl: true, webhookSecretPlaintext: true },
    });

    if (!tenant?.webhookUrl || !tenant.webhookSecretPlaintext) return;

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

    await this.prisma.unscoped.outboundEvent.create({
      data: {
        tenantId,
        eventType,
        payload: payloadObj as any,
        targetUrl: tenant.webhookUrl,
        status: 'PENDING',
        attempts: 0,
      },
    });

    fetch(tenant.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': 'nid_role',
      },
      body: payload,
    }).catch(() => {});
  }
}
