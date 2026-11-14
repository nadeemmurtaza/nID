import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import type { Account } from '@nid/db';

export interface CreateDepartmentDto {
  name: string;
  slug?: string;
  defaultPermissions?: string[];
  icon?: string;
  color?: string;
}

export interface UpdateDepartmentDto {
  name?: string;
  slug?: string;
  defaultPermissions?: string[];
  icon?: string;
  color?: string;
}

export interface AssignDepartmentDto {
  accountId: string;
  organizationId?: string;
  brandId?: string;
  scope?: 'TENANT' | 'ORGANIZATION' | 'BRAND';
}

export interface DepartmentInfo {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  defaultPermissions: string[] | null;
  icon: string | null;
  color: string | null;
  inheritedFromTenant: boolean;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
}

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a department at the tenant level.
   */
  async createDepartment(
    callerAccount: Account,
    tenantId: string,
    dto: CreateDepartmentDto,
  ): Promise<DepartmentInfo> {
    // Verify caller is owner/partner
    await this.requireOwnerOrPartner(callerAccount, tenantId);

    const slug = dto.slug || this.slugify(dto.name);

    // Check for duplicate
    const existing = await this.prisma.unscoped.department.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });

    if (existing) {
      throw new ConflictException(`A department with slug "${slug}" already exists.`);
    }

    const dept = await this.prisma.unscoped.department.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        defaultPermissions: dto.defaultPermissions ?? Prisma.JsonNull,
        icon: dto.icon ?? null,
        color: dto.color ?? null,
        inheritedFromTenant: true,
      },
    });

    await this.emitWebhookEvent(tenantId, 'department.created', dept);
    return this.formatDepartment(dept, 0);
  }

  /**
   * List all departments for a tenant (inherited + custom).
   */
  async listDepartments(
    callerAccount: Account,
    tenantId: string,
  ): Promise<DepartmentInfo[]> {
    await this.requireAccess(callerAccount, tenantId);

    const depts = await this.prisma.unscoped.department.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    // Count members for each department
    const results = await Promise.all(
      depts.map(async (dept) => {
        const count = await this.prisma.unscoped.departmentAssignment.count({
          where: { departmentId: dept.id },
        });
        return this.formatDepartment(dept, count);
      }),
    );

    return results;
  }

  /**
   * Get a single department.
   */
  async getDepartment(
    callerAccount: Account,
    tenantId: string,
    departmentId: string,
  ): Promise<DepartmentInfo> {
    await this.requireAccess(callerAccount, tenantId);

    const dept = await this.prisma.unscoped.department.findUnique({
      where: { id: departmentId, tenantId },
    });

    if (!dept) {
      throw new NotFoundException('Department not found.');
    }

    const count = await this.prisma.unscoped.departmentAssignment.count({
      where: { departmentId: dept.id },
    });

    return this.formatDepartment(dept, count);
  }

  /**
   * Update a department.
   */
  async updateDepartment(
    callerAccount: Account,
    tenantId: string,
    departmentId: string,
    dto: UpdateDepartmentDto,
  ): Promise<DepartmentInfo> {
    await this.requireOwnerOrPartner(callerAccount, tenantId);

    const dept = await this.prisma.unscoped.department.findUnique({
      where: { id: departmentId, tenantId },
    });

    if (!dept) {
      throw new NotFoundException('Department not found.');
    }

    // Check slug uniqueness
    const newSlug = dto.slug ?? dept.slug;
    if (dto.slug && dto.slug !== dept.slug) {
      const existing = await this.prisma.unscoped.department.findUnique({
        where: { tenantId_slug: { tenantId, slug: dto.slug } },
      });
      if (existing) {
        throw new ConflictException(`A department with slug "${dto.slug}" already exists.`);
      }
    }

    const updated = await this.prisma.unscoped.department.update({
      where: { id: departmentId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: newSlug }),
        ...(dto.defaultPermissions !== undefined && { defaultPermissions: dto.defaultPermissions as any }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    });

    await this.emitWebhookEvent(tenantId, 'department.updated', updated);

    const count = await this.prisma.unscoped.departmentAssignment.count({
      where: { departmentId: updated.id },
    });

    return this.formatDepartment(updated, count);
  }

  /**
   * Assign an account to a department.
   */
  async assignDepartment(
    callerAccount: Account,
    tenantId: string,
    departmentId: string,
    dto: AssignDepartmentDto,
  ): Promise<{ message: string }> {
    await this.requireOwnerOrPartner(callerAccount, tenantId);

    // Verify department exists
    const dept = await this.prisma.unscoped.department.findUnique({
      where: { id: departmentId, tenantId },
    });

    if (!dept) {
      throw new NotFoundException('Department not found.');
    }

    // Verify account exists
    const account = await this.prisma.unscoped.account.findUnique({
      where: { id: dto.accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found.');
    }

    const scope = dto.scope || (dto.brandId ? 'BRAND' : dto.organizationId ? 'ORGANIZATION' : 'TENANT');

    // Check for duplicate
    const existing = await this.prisma.unscoped.departmentAssignment.findFirst({
      where: {
        accountId: dto.accountId,
        departmentId,
        scope,
        organizationId: dto.organizationId ?? null,
        brandId: dto.brandId ?? null,
      },
    });

    if (existing) {
      throw new ConflictException('This account is already assigned to this department at this scope.');
    }

    await this.prisma.unscoped.departmentAssignment.create({
      data: {
        accountId: dto.accountId,
        departmentId,
        tenantId,
        organizationId: dto.organizationId ?? null,
        brandId: dto.brandId ?? null,
        scope,
      },
    });

    await this.emitWebhookEvent(tenantId, 'department.assigned', {
      departmentId,
      accountId: dto.accountId,
      scope,
    });

    return { message: 'Department assignment created.' };
  }

  /**
   * Remove a department assignment.
   */
  async removeDepartmentAssignment(
    callerAccount: Account,
    tenantId: string,
    departmentId: string,
    accountId: string,
  ): Promise<{ message: string }> {
    await this.requireOwnerOrPartner(callerAccount, tenantId);

    await this.prisma.unscoped.departmentAssignment.deleteMany({
      where: { departmentId, accountId, tenantId },
    });

    await this.emitWebhookEvent(tenantId, 'department.unassigned', {
      departmentId,
      accountId,
    });

    return { message: 'Department assignment removed.' };
  }

  /**
   * Get department assignments for an account.
   */
  async getAccountDepartments(
    callerAccount: Account,
    tenantId: string,
    accountId: string,
  ): Promise<any[]> {
    await this.requireAccess(callerAccount, tenantId);

    const assignments = await this.prisma.unscoped.departmentAssignment.findMany({
      where: { accountId, tenantId },
      include: {
        department: {
          select: { id: true, name: true, slug: true, icon: true, color: true },
        },
      },
    });

    return assignments.map((a) => ({
      departmentId: a.departmentId,
      departmentName: a.department.name,
      departmentSlug: a.department.slug,
      icon: a.department.icon,
      color: a.department.color,
      scope: a.scope,
      organizationId: a.organizationId,
      brandId: a.brandId,
    }));
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

  private formatDepartment(dept: any, memberCount: number): DepartmentInfo {
    return {
      id: dept.id,
      tenantId: dept.tenantId,
      name: dept.name,
      slug: dept.slug,
      defaultPermissions: dept.defaultPermissions as string[] | null,
      icon: dept.icon,
      color: dept.color,
      inheritedFromTenant: dept.inheritedFromTenant,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
      memberCount,
    };
  }

  private async emitWebhookEvent(tenantId: string, eventType: string, data: Record<string, unknown> | unknown[]) {
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
        payload: payloadObj as Prisma.InputJsonValue,
        targetUrl: tenant.webhookUrl,
        status: 'PENDING',
        attempts: 0,
      },
    });

    // Fire-and-forget
    fetch(tenant.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': 'nid_department',
      },
      body: payload,
    }).catch(() => {});
  }
}
