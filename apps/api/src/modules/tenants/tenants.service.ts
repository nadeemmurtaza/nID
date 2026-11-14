import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { generateApiKey } from '@nid/shared-types';
import { Prisma } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import type { ActorType } from '../../core/auth/types';

export interface CreateTenantDto {
  name: string;
  slug: string;
  dataResidencyRegion?: string;
  webhookUrl?: string;
  billingWebhookUrl?: string;
  /** Optional: if provided, the first staff account ID to seed the new tenant with */
  initialStaffAccountId?: string;
}

export interface UpdateTenantDto {
  name?: string;
  dataResidencyRegion?: string;
  webhookUrl?: string | null;
  webhookSecretPlaintext?: string | null;
  billingWebhookUrl?: string | null;
  billingWebhookSecretPlaintext?: string | null;
}

export interface CreateTenantApiKeyDto {
  keyPrefix?: string;
  scopes?: string[];
  rateLimitPerMinute?: number;
}

export interface InviteTenantStaffDto {
  accountId: string;
  role?: 'STAFF' | 'ADMIN';
}

/** Returned by GET /v1/tenants/my-memberships — one row per tenant the account works for. */
export interface TenantMembership {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: string;
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getSelf(tenantId: string, actorType: ActorType) {
    const tenant = await this.prisma.forTenant(tenantId, (tx) =>
      tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          dataResidencyRegion: true,
          webhookUrl: true,
          billingWebhookUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
    return { ...tenant, signedInAs: actorType };
  }

  /**
   * List all tenants this account is a staff member of.
   * Used by profile-ui Work Profile tab to show tenant memberships.
   */
  async getMembershipsForAccount(accountId: string): Promise<TenantMembership[]> {
    const memberships = await this.prisma.unscoped.tenantStaffMembership.findMany({
      where: { accountId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return memberships.map((m) => ({
      tenantId: m.tenant.id,
      tenantName: m.tenant.name,
      tenantSlug: m.tenant.slug,
      role: m.role,
    }));
  }

  /**
   * Platform-admin endpoint: create a new tenant. Uses unscoped Prisma
   * because there is no tenant context yet — this is the bootstrap call
   * that creates the first tenant row. Protected by PlatformAdminGuard
   * (checks PLATFORM_ADMIN_SECRET env var in Authorization header).
   */
  async create(dto: CreateTenantDto) {
    // Validate slug format: lowercase alphanumeric with hyphens, 3-64 chars
    const slugRegex = /^[a-z0-9][a-z0-9-]{2,63}$/;
    if (!slugRegex.test(dto.slug)) {
      throw new BadRequestException(
        'Slug must be 3-64 lowercase alphanumeric characters or hyphens, starting with a letter or number.',
      );
    }

    // Check for duplicate slug (duplication prevention)
    const existing = await this.prisma.unscoped.tenant.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`A tenant with slug '${dto.slug}' already exists.`);
    }

    // Generate webhook secrets
    const webhookSecret = randomBytes(32).toString('hex');
    const billingWebhookSecret = randomBytes(32).toString('hex');

    const tenant = await this.prisma.unscoped.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        dataResidencyRegion: dto.dataResidencyRegion ?? 'global',
        webhookUrl: dto.webhookUrl ?? null,
        webhookSecretPlaintext: webhookSecret,
        billingWebhookUrl: dto.billingWebhookUrl ?? null,
        billingWebhookSecretPlaintext: billingWebhookSecret,
      },
    });

    // If initial staff account is provided, add them as ADMIN
    if (dto.initialStaffAccountId) {
      const account = await this.prisma.unscoped.account.findUnique({
        where: { id: dto.initialStaffAccountId },
      });
      if (!account) {
        throw new NotFoundException(`Account ${dto.initialStaffAccountId} not found.`);
      }
      await this.prisma.unscoped.tenantStaffMembership.create({
        data: {
          tenantId: tenant.id,
          accountId: dto.initialStaffAccountId,
          role: 'ADMIN',
        },
      });
    }

    // Emit webhook event for tenant creation (for Communicator sync)
    await this.emitWebhookEvent(tenant.id, 'tenant.created', {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      createdAt: tenant.createdAt.toISOString(),
    });

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      dataResidencyRegion: tenant.dataResidencyRegion,
      webhookUrl: tenant.webhookUrl,
      webhookSecret: webhookSecret,
      billingWebhookUrl: tenant.billingWebhookUrl,
      billingWebhookSecret: billingWebhookSecret,
      createdAt: tenant.createdAt.toISOString(),
      message: 'Tenant created successfully. Save the webhook secrets — they cannot be recovered.',
    };
  }

  /**
   * Platform-admin endpoint: list all tenants (for platform admin dashboard).
   */
  async listAll() {
    const tenants = await this.prisma.unscoped.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        dataResidencyRegion: true,
        webhookUrl: true,
        billingWebhookUrl: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            apiKeys: true,
            staff: true,
            subjects: true,
            cases: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  /**
   * Get a tenant by ID (platform-admin or tenant-self).
   */
  async getById(id: string) {
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        dataResidencyRegion: true,
        webhookUrl: true,
        billingWebhookUrl: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            apiKeys: true,
            staff: true,
            subjects: true,
            cases: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found.`);
    }

    return {
      ...tenant,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    };
  }

  /**
   * Update tenant profile data. Triggers webhook to registered URLs
   * for real-time sync to Communicator and other services.
   */
  async update(id: string, dto: UpdateTenantDto, actorId?: string) {
    const tenant = await this.prisma.unscoped.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found.`);
    }

    const updated = await this.prisma.unscoped.tenant.update({
      where: { id },
      data: {
        name: dto.name ?? tenant.name,
        dataResidencyRegion: dto.dataResidencyRegion ?? tenant.dataResidencyRegion,
        webhookUrl: dto.webhookUrl,
        webhookSecretPlaintext:
          dto.webhookSecretPlaintext ?? tenant.webhookSecretPlaintext,
        billingWebhookUrl: dto.billingWebhookUrl,
        billingWebhookSecretPlaintext:
          dto.billingWebhookSecretPlaintext ?? tenant.billingWebhookSecretPlaintext,
      },
    });

    // Emit webhook event for tenant update (for Communicator sync)
    await this.emitWebhookEvent(updated.id, 'tenant.updated', {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      updatedAt: updated.updatedAt.toISOString(),
      changedFields: Object.keys(dto).filter((k) => dto[k as keyof UpdateTenantDto] !== undefined),
    });

    if (actorId) {
      await this.audit.record(this.prisma.unscoped, id, {
        actorType: 'SYSTEM',
        actorId,
        action: 'tenant.update',
        subjectId: id,
      });
    }

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      dataResidencyRegion: updated.dataResidencyRegion,
      webhookUrl: updated.webhookUrl,
      billingWebhookUrl: updated.billingWebhookUrl,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Create an API key for a tenant.
   */
  async createApiKey(tenantId: string, dto: CreateTenantApiKeyDto) {
    const tenant = await this.prisma.unscoped.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found.`);
    }

    const key = generateApiKey('live');
    await this.prisma.unscoped.tenantApiKey.create({
      data: {
        tenantId,
        keyPrefix: key.prefix,
        keyHash: key.hash,
        scopes: dto.scopes ?? ['verification-cases:read', 'verification-cases:write'],
        rateLimitPerMinute: dto.rateLimitPerMinute ?? 60,
      },
    });

    return {
      prefix: key.prefix,
      plaintext: key.plaintext,
      message: 'API key created. Save the plaintext key — it cannot be recovered.',
    };
  }

  /**
   * List API keys for a tenant (without the hash).
   */
  async listApiKeys(tenantId: string) {
    const keys = await this.prisma.unscoped.tenantApiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        keyPrefix: true,
        scopes: true,
        rateLimitPerMinute: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => ({
      ...k,
      createdAt: k.createdAt.toISOString(),
      revokedAt: k.revokedAt?.toISOString() ?? null,
    }));
  }

  /**
   * Revoke an API key.
   */
  async revokeApiKey(tenantId: string, apiKeyId: string) {
    await this.prisma.unscoped.tenantApiKey.updateMany({
      where: { id: apiKeyId, tenantId },
      data: { revokedAt: new Date() },
    });

    return { message: 'API key revoked.' };
  }

  /**
   * Invite a staff member to a tenant.
   */
  async inviteStaff(tenantId: string, dto: InviteTenantStaffDto) {
    const tenant = await this.prisma.unscoped.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found.`);
    }

    const account = await this.prisma.unscoped.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${dto.accountId} not found.`);
    }

    const existing = await this.prisma.unscoped.tenantStaffMembership.findUnique({
      where: {
        tenantId_accountId: { tenantId, accountId: dto.accountId },
      },
    });
    if (existing) {
      throw new ConflictException('This account is already a staff member of this tenant.');
    }

    const membership = await this.prisma.unscoped.tenantStaffMembership.create({
      data: {
        tenantId,
        accountId: dto.accountId,
        role: dto.role ?? 'STAFF',
      },
    });

    return {
      id: membership.id,
      accountId: membership.accountId,
      role: membership.role,
      message: 'Staff member added successfully.',
    };
  }

  /**
   * List staff members of a tenant.
   */
  async listStaff(tenantId: string) {
    const staff = await this.prisma.unscoped.tenantStaffMembership.findMany({
      where: { tenantId },
      include: {
        account: {
          select: {
            id: true,
            phone: true,
            phoneVerifiedAt: true,
          },
        },
      },
    });

    return staff.map((s) => ({
      id: s.id,
      accountId: s.accountId,
      role: s.role,
      phone: s.account?.phone,
      phoneVerified: s.account?.phoneVerifiedAt !== null,
    }));
  }

  /**
   * Remove a staff member from a tenant.
   */
  async removeStaff(tenantId: string, accountId: string) {
    await this.prisma.unscoped.tenantStaffMembership.deleteMany({
      where: { tenantId, accountId },
    });

    return { message: 'Staff member removed.' };
  }

  /**
   * Emit a webhook event to the tenant's registered webhook URL.
   * This is the core mechanism for real-time sync to Communicator.
   * Uses OutboundEvent model for tracking delivery status.
   */
  private async emitWebhookEvent(tenantId: string, eventType: string, data: Record<string, unknown> | unknown[]) {
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id: tenantId },
      select: { webhookUrl: true, webhookSecretPlaintext: true },
    });

    if (!tenant?.webhookUrl || !tenant.webhookSecretPlaintext) {
      // No webhook configured — not an error, just skip
      return;
    }

    const payloadObj = {
      event_type: eventType,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
      data,
    };
    const payload = JSON.stringify(payloadObj);

    // Compute HMAC signature
    const crypto = await import('node:crypto');
    const signature = crypto
      .default.createHmac('sha256', tenant.webhookSecretPlaintext)
      .update(payload)
      .digest('hex');

    // Log the outbound webhook event using OutboundEvent model
    const outboundEvent = await this.prisma.unscoped.outboundEvent.create({
      data: {
        tenantId,
        eventType,
        payload: payloadObj as Prisma.InputJsonValue,
        targetUrl: tenant.webhookUrl,
        status: 'PENDING',
        attempts: 0,
      },
    });

    // Fire-and-forget delivery attempt
    this.deliverWebhook(outboundEvent.id, tenant.webhookUrl, payload, signature).catch((err) => {
      // Log delivery failure but don't fail the operation
      console.error(`Webhook delivery failed for tenant ${tenantId}:`, err);
    });
  }

  /**
   * Deliver a webhook payload to the tenant's URL with retry logic.
   */
  private async deliverWebhook(
    outboundEventId: string,
    url: string,
    payload: string,
    signature: string,
  ): Promise<void> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-nID-Event': 'tenant_event',
            'X-nID-Signature': `sha256=${signature}`,
          },
          body: payload,
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          // Update outbound event status to delivered
          await this.prisma.unscoped.outboundEvent.update({
            where: { id: outboundEventId },
            data: {
              status: 'DELIVERED',
              deliveredAt: new Date(),
              attempts: attempt,
            },
          });
          return;
        }

        lastError = new Error(`HTTP ${response.status}`);
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    // Mark as failed after all retries
    await this.prisma.unscoped.outboundEvent.update({
      where: { id: outboundEventId },
      data: {
        status: 'FAILED',
        lastError: lastError?.message,
        attempts: maxRetries,
      },
    });
  }
}
