import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Brand } from '@nid/db';
import { Prisma } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

export interface CreateBrandDto {
  organizationId: string;
  name: string;
  slug?: string;
  description?: string;
  bio?: string;
  logoKey?: string;
  primaryColor?: string;
  secondaryColor?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  socialLinks?: Record<string, string>;
  products?: unknown[];
  services?: unknown[];
  prices?: Record<string, unknown>;
  policies?: Record<string, unknown>;
  rules?: Record<string, unknown>;
  toneGuidelines?: string;
  keywords?: string[];
}

export interface UpdateBrandDto {
  name?: string;
  slug?: string;
  description?: string;
  bio?: string;
  logoKey?: string;
  primaryColor?: string;
  secondaryColor?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  socialLinks?: Record<string, string>;
  products?: unknown[];
  services?: unknown[];
  prices?: Record<string, unknown>;
  policies?: Record<string, unknown>;
  rules?: Record<string, unknown>;
  toneGuidelines?: string;
  keywords?: string[];
  active?: boolean;
}

export interface BrandMembership {
  brandId: string;
  brandName: string;
  brandSlug: string;
  organizationId: string;
  organizationName: string;
  tenantId: string;
  tenantName: string;
  role: string;
}

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  /**
   * Create a brand under an organization.
   * The account must be an ACTIVE admin member of the organization.
   * Emits webhook to the tenant's registered webhook URL for Communicator sync.
   */
  async create(accountId: string, dto: CreateBrandDto): Promise<Brand & { webhookMessage?: string }> {
    // Verify account is admin of the organization
    await this.organizations.requireActiveAdmin(
      dto.organizationId,
      accountId,
    );

    // Get organization to find tenant for webhook
    const organization = await this.prisma.unscoped.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true, tenantId: true, legalName: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Auto-generate slug from name if not provided
    const slug = dto.slug || this.slugify(dto.name);

    // Check for duplicate slug within the organization
    const existing = await this.prisma.unscoped.brand.findUnique({
      where: { organizationId_slug: { organizationId: dto.organizationId, slug } },
    });

    if (existing) {
      throw new ConflictException(
        `A brand with slug "${slug}" already exists in this organization.`,
      );
    }

    // Create the brand
    const brand = await this.prisma.unscoped.brand.create({
      data: {
        organizationId: dto.organizationId,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        bio: dto.bio ?? null,
        website: dto.website ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        logoKey: dto.logoKey ?? null,
        primaryColor: dto.primaryColor ?? null,
        secondaryColor: dto.secondaryColor ?? null,
        address: dto.address ?? null,
        socialLinks: (dto.socialLinks as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        products: (dto.products as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        services: (dto.services as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        prices: (dto.prices as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        policies: (dto.policies as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        rules: (dto.rules as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        toneGuidelines: (dto.toneGuidelines as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        keywords: (dto.keywords as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
      include: {
        organization: true,
      },
    });

    // Emit webhook event for brand creation (for Communicator sync)
    const webhookMessage = await this.emitWebhookEvent(
      brand.organization.tenantId,
      'brand.created',
      brand,
    );

    return { ...brand, webhookMessage };
  }

  /**
   * List all brands for a specific organization.
   * The account must be an ACTIVE member of the organization.
   */
  async list(accountId: string, organizationId: string): Promise<Brand[]> {
    await this.organizations.requireActiveMember(organizationId, accountId);

    return this.prisma.unscoped.brand.findMany({
      where: { organizationId, active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get a single brand by ID.
   * The account must be an ACTIVE member of the brand's organization.
   */
  async getById(accountId: string, brandId: string): Promise<Brand> {
    const brand = await this.prisma.unscoped.brand.findUnique({
      where: { id: brandId },
      include: {
        organization: true,
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Verify account is member of the brand's organization
    await this.organizations.requireActiveMember(brand.organizationId, accountId);

    return brand;
  }

  /**
   * Update a brand. The account must be an ACTIVE admin of the brand's organization.
   * Emits webhook for Communicator sync.
   */
  async update(
    accountId: string,
    brandId: string,
    dto: UpdateBrandDto,
  ): Promise<Brand & { webhookMessage?: string }> {
    const brand = await this.prisma.unscoped.brand.findUnique({
      where: { id: brandId },
      select: { id: true, organizationId: true, slug: true },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Verify account is admin of the brand's organization
    const membership = await this.organizations.requireActiveAdmin(
      brand.organizationId,
      accountId,
    );

    // If slug is changing, check for duplicates
    const newSlug = dto.slug ?? brand.slug;
    if (dto.slug && dto.slug !== brand.slug) {
      const existing = await this.prisma.unscoped.brand.findUnique({
        where: {
          organizationId_slug: {
            organizationId: brand.organizationId,
            slug: dto.slug,
          },
        },
      });

      if (existing) {
        throw new ConflictException(
          `A brand with slug "${dto.slug}" already exists in this organization.`,
        );
      }
    }

    // Update the brand
    const updated = await this.prisma.unscoped.brand.update({
      where: { id: brandId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: newSlug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.logoKey !== undefined && { logoKey: dto.logoKey }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.secondaryColor !== undefined && { secondaryColor: dto.secondaryColor }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.socialLinks !== undefined && { socialLinks: dto.socialLinks as Prisma.InputJsonValue }),
        ...(dto.products !== undefined && { products: dto.products as Prisma.InputJsonValue }),
        ...(dto.services !== undefined && { services: dto.services as Prisma.InputJsonValue }),
        ...(dto.prices !== undefined && { prices: dto.prices as Prisma.InputJsonValue }),
        ...(dto.policies !== undefined && { policies: dto.policies as Prisma.InputJsonValue }),
        ...(dto.rules !== undefined && { rules: dto.rules as Prisma.InputJsonValue }),
        ...(dto.toneGuidelines !== undefined && { toneGuidelines: dto.toneGuidelines as Prisma.InputJsonValue }),
        ...(dto.keywords !== undefined && { keywords: dto.keywords as Prisma.InputJsonValue }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      include: {
        organization: true,
      },
    });

    // Emit webhook event for brand update (for Communicator sync)
    const webhookMessage = await this.emitWebhookEvent(
      membership.tenantId,
      'brand.updated',
      updated,
    );

    return { ...updated, webhookMessage };
  }

  /**
   * Delete (deactivate) a brand. The account must be an ACTIVE admin of the brand's organization.
   * Uses soft delete (sets active = false).
   */
  async remove(accountId: string, brandId: string): Promise<{ message: string }> {
    const brand = await this.prisma.unscoped.brand.findUnique({
      where: { id: brandId },
      select: { id: true, organizationId: true },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Verify account is admin of the brand's organization
    const membership = await this.organizations.requireActiveAdmin(
      brand.organizationId,
      accountId,
    );

    // Soft delete
    await this.prisma.unscoped.brand.update({
      where: { id: brandId },
      data: { active: false },
    });

    // Emit webhook for brand deletion
    await this.emitWebhookEvent(membership.tenantId, 'brand.deleted', {
      id: brandId,
      organizationId: brand.organizationId,
    });

    return { message: 'Brand deactivated successfully' };
  }

  /**
   * List all brands across all organizations the account is a member of.
   * Used by the work profile to show all brands the user works with.
   */
  async listMyMemberships(accountId: string): Promise<BrandMembership[]> {
    // Find the person subject for this account
    const subject = await this.prisma.unscoped.subject.findFirst({
      where: { accountId },
      select: { id: true },
    });

    if (!subject) {
      return [];
    }

    // Get all organizations the account is an active member of
    const memberships = await this.prisma.unscoped.organizationMembership.findMany({
      where: {
        personSubjectId: subject.id,
        status: 'ACTIVE',
      },
      select: {
        organizationId: true,
        role: true,
        isAdmin: true,
        organization: {
          select: {
            id: true,
            legalName: true,
            tenantId: true,
          },
        },
      },
    });

    const results: BrandMembership[] = [];

    for (const mem of memberships) {
      const org = mem.organization;
      if (!org) continue;

      const brands = await this.prisma.unscoped.brand.findMany({
        where: {
          organizationId: mem.organizationId,
          active: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });

      for (const brand of brands) {
        results.push({
          brandId: brand.id,
          brandName: brand.name,
          brandSlug: brand.slug,
          organizationId: org.id,
          organizationName: org.legalName,
          tenantId: org.tenantId,
          tenantName: '',
          role: mem.role ?? (mem.isAdmin ? 'admin' : 'member'),
        });
      }
    }

    return results;
  }

  /**
   * Generate a URL-friendly slug from a brand name.
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Emit a webhook event to the tenant's registered webhook URL.
   * Follows the same pattern as tenants.service.ts for consistency.
   * Returns a message if webhook was sent, undefined if no webhook configured.
   */
  private async emitWebhookEvent(
    tenantId: string,
    eventType: string,
    data: unknown,
  ): Promise<string | undefined> {
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id: tenantId },
      select: { webhookUrl: true, webhookSecretPlaintext: true },
    });

    if (!tenant?.webhookUrl || !tenant.webhookSecretPlaintext) {
      // No webhook configured — not an error, just skip
      return undefined;
    }

    const payload = JSON.stringify({
      event_type: eventType,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
      data,
    });

    // Sign the payload with HMAC-SHA256
    const { createHmac } = await import('crypto');
    const signature = createHmac('sha256', tenant.webhookSecretPlaintext)
      .update(payload)
      .digest('hex');

    // Log the outbound webhook event
    await this.prisma.unscoped.outboundEvent.create({
      data: {
        tenantId,
        eventType,
        payload: { event_type: eventType, tenant_id: tenantId },
        targetUrl: tenant.webhookUrl,
        status: 'PENDING',
        attempts: 0,
      },
    });

    // Deliver the webhook (fire and forget with error logging)
    this.deliverWebhook(tenant.webhookUrl, payload, signature).catch((err) => {
      console.error(`Brand webhook delivery failed for tenant ${tenantId}:`, err);
    });

    return 'Webhook event emitted successfully';
  }

  /**
   * Deliver a webhook payload to the tenant's URL.
   */
  private async deliverWebhook(
    url: string,
    payload: string,
    signature: string,
  ): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-nID-Signature': `sha256=${signature}`,
        'X-nID-Event': 'brand_event',
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
    }
  }
}
