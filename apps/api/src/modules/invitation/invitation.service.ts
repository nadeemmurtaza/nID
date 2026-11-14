import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import type { Account } from '@nid/db';
import { Prisma } from '@nid/db';

export interface SendEmailInviteDto {
  email: string;
  organizationId?: string;
  brandId?: string;
  roleDefinitionId?: string;
  departmentId?: string;
}

export interface SendUsernameInviteDto {
  username: string;
  organizationId?: string;
  brandId?: string;
  roleDefinitionId?: string;
  departmentId?: string;
}

export interface AcceptInvitationDto {
  invitationId: string;
}

export interface InvitationInfo {
  id: string;
  tenantId: string;
  email: string | null;
  username: string | null;
  invitedBy: string;
  organizationId: string | null;
  brandId: string | null;
  scope: string;
  roleDefinitionId: string | null;
  departmentId: string | null;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedBy: string | null;
  createdAt: Date;
}

@Injectable()
export class InvitationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Send an email invitation.
   */
  async sendEmailInvite(
    callerAccount: Account,
    tenantId: string,
    dto: SendEmailInviteDto,
  ): Promise<InvitationInfo> {
    await this.requireOwnerOrPartner(callerAccount, tenantId);

    // Check for existing pending invitation
    const existing = await this.prisma.unscoped.invitation.findFirst({
      where: {
        email: dto.email,
        tenantId,
        status: 'PENDING',
      },
    });

    if (existing) {
      throw new BadRequestException('A pending invitation already exists for this email.');
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.prisma.unscoped.invitation.create({
      data: {
        tenantId,
        email: dto.email,
        invitedBy: callerAccount.id,
        organizationId: dto.organizationId ?? null,
        brandId: dto.brandId ?? null,
        scope: dto.brandId ? 'BRAND' : dto.organizationId ? 'ORGANIZATION' : 'TENANT',
        roleDefinitionId: dto.roleDefinitionId ?? null,
        departmentId: dto.departmentId ?? null,
        expiresAt,
      },
    });

    // TODO: Send actual email via SMTP service
    // await this.sendEmail(dto.email, invitation.id);

    return this.formatInvitation(invitation);
  }

  /**
   * Send a username-based invitation.
   */
  async sendUsernameInvite(
    callerAccount: Account,
    tenantId: string,
    dto: SendUsernameInviteDto,
  ): Promise<InvitationInfo> {
    await this.requireOwnerOrPartner(callerAccount, tenantId);

    // Find account by username (phone or email)
    const targetAccount = await this.prisma.unscoped.account.findFirst({
      where: {
        OR: [
          { phone: dto.username },
          { email: dto.username },
        ],
      },
    });

    if (!targetAccount) {
      throw new NotFoundException('No account found with this username.');
    }

    // Check for existing pending invitation
    const existing = await this.prisma.unscoped.invitation.findFirst({
      where: {
        username: dto.username,
        tenantId,
        status: 'PENDING',
      },
    });

    if (existing) {
      throw new BadRequestException('A pending invitation already exists for this username.');
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.prisma.unscoped.invitation.create({
      data: {
        tenantId,
        username: dto.username,
        invitedBy: callerAccount.id,
        organizationId: dto.organizationId ?? null,
        brandId: dto.brandId ?? null,
        scope: dto.brandId ? 'BRAND' : dto.organizationId ? 'ORGANIZATION' : 'TENANT',
        roleDefinitionId: dto.roleDefinitionId ?? null,
        departmentId: dto.departmentId ?? null,
        expiresAt,
      },
    });

    return this.formatInvitation(invitation);
  }

  /**
   * Accept an invitation.
   */
  async acceptInvitation(
    acceptingAccount: Account,
    dto: AcceptInvitationDto,
  ): Promise<{ message: string }> {
    const invitation = await this.prisma.unscoped.invitation.findUnique({
      where: { id: dto.invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('This invitation is no longer pending.');
    }

    if (invitation.expiresAt < new Date()) {
      // Expire the invitation
      await this.prisma.unscoped.invitation.update({
        where: { id: dto.invitationId },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('This invitation has expired.');
    }

    // Verify the accepting account matches the invitation
    if (invitation.email && acceptingAccount.email !== invitation.email) {
      throw new BadRequestException('This invitation is not for your account.');
    }

    if (invitation.username && acceptingAccount.phone !== invitation.username && acceptingAccount.email !== invitation.username) {
      throw new BadRequestException('This invitation is not for your account.');
    }

    // Update invitation status
    await this.prisma.unscoped.invitation.update({
      where: { id: dto.invitationId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        acceptedBy: acceptingAccount.id,
      },
    });

    // Create access grant
    await this.prisma.unscoped.accessGrant.create({
      data: {
        accountId: acceptingAccount.id,
        tenantId: invitation.tenantId,
        organizationId: invitation.organizationId,
        brandId: invitation.brandId,
        accessType: 'MEMBER',
        grantedBy: invitation.invitedBy,
        status: 'ACTIVE',
      },
    });

    // Assign role if specified
    if (invitation.roleDefinitionId) {
      await this.prisma.unscoped.roleAssignment.create({
        data: {
          accountId: acceptingAccount.id,
          roleDefinitionId: invitation.roleDefinitionId,
          tenantId: invitation.tenantId,
          organizationId: invitation.organizationId,
          brandId: invitation.brandId,
          scope: invitation.scope,
        },
      });
    }

    // Assign department if specified
    if (invitation.departmentId) {
      await this.prisma.unscoped.departmentAssignment.create({
        data: {
          accountId: acceptingAccount.id,
          departmentId: invitation.departmentId,
          tenantId: invitation.tenantId,
          organizationId: invitation.organizationId,
          brandId: invitation.brandId,
          scope: invitation.scope,
        },
      });
    }

    // Emit webhook
    await this.emitWebhookEvent(invitation.tenantId, 'invitation.accepted', {
      invitationId: dto.invitationId,
      accountId: acceptingAccount.id,
    });

    return { message: 'Invitation accepted. Access granted.' };
  }

  /**
   * List all invitations for a tenant.
   */
  async listInvitations(
    callerAccount: Account,
    tenantId: string,
    status?: string,
  ): Promise<InvitationInfo[]> {
    await this.requireAccess(callerAccount, tenantId);

    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    const invitations = await this.prisma.unscoped.invitation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((i) => this.formatInvitation(i));
  }

  /**
   * Revoke an invitation.
   */
  async revokeInvitation(
    callerAccount: Account,
    tenantId: string,
    invitationId: string,
  ): Promise<{ message: string }> {
    await this.requireOwnerOrPartner(callerAccount, tenantId);

    const invitation = await this.prisma.unscoped.invitation.findUnique({
      where: { id: invitationId, tenantId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Only pending invitations can be revoked.');
    }

    await this.prisma.unscoped.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });

    return { message: 'Invitation revoked.' };
  }

  /**
   * Expire all expired invitations (cleanup).
   */
  async expireOldInvitations(): Promise<{ count: number }> {
    const now = new Date();
    const result = await this.prisma.unscoped.invitation.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });

    return { count: result.count };
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
      throw new BadRequestException('Only tenant owners or partners can send invitations.');
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
      throw new BadRequestException('You do not have access to this tenant.');
    }
  }

  private formatInvitation(inv: any): InvitationInfo {
    return {
      id: inv.id,
      tenantId: inv.tenantId,
      email: inv.email,
      username: inv.username,
      invitedBy: inv.invitedBy,
      organizationId: inv.organizationId,
      brandId: inv.brandId,
      scope: inv.scope,
      roleDefinitionId: inv.roleDefinitionId,
      departmentId: inv.departmentId,
      status: inv.status,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      acceptedBy: inv.acceptedBy,
      createdAt: inv.createdAt,
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
        'X-Webhook-Event': 'nid_invitation',
      },
      body: payload,
    }).catch(() => {});
  }
}
