import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, apiKeyId: string, dto: CreateOrganizationDto) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const subject = await tx.subject.create({
        data: { tenantId, type: 'ORGANIZATION', givenName: dto.legalName },
      });
      const organization = await tx.organization.create({
        data: {
          tenantId,
          subjectId: subject.id,
          legalName: dto.legalName,
          registrationNumber: dto.registrationNumber,
          countryCode: dto.countryCode,
        },
      });

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'organization.create',
        subjectId: subject.id,
      });

      return organization;
    });
  }

  /**
   * "Verified" here means exactly what org_membership's provider checks:
   * at least one APPROVED VerificationCase for this Organization's own
   * Subject, claimType IDENTITY — real KYB, not an assumption from the row
   * merely existing. Strongest-first, same ORDER BY level DESC convention
   * badge-ranking.ts already documents.
   */
  async getById(tenantId: string, apiKeyId: string, organizationId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new NotFoundException('Organization not found.');
      }

      const verifiedCase = await tx.verificationCase.findFirst({
        where: { subjectId: organization.subjectId, status: 'APPROVED', claimType: 'IDENTITY' },
        orderBy: { level: 'desc' },
        select: { id: true, level: true, resolvedAt: true },
      });

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'organization.read',
        subjectId: organization.subjectId,
      });

      return {
        ...organization,
        isVerified: verifiedCase !== null,
        verifiedLevel: verifiedCase?.level ?? null,
        verifiedCaseId: verifiedCase?.id ?? null,
        verifiedAt: verifiedCase?.resolvedAt ?? null,
      };
    });
  }

  /**
   * The attestation act org_membership's provider requires before a member
   * can inherit anything from this Organization's verification — never the
   * subject's own self-declaration (a VerificationCase's organizationId
   * input is only a claim; this row is the proof). Requires the person
   * Subject to already exist in this tenant, same as every other
   * relationship in this schema.
   */
  async addMember(tenantId: string, apiKeyId: string, organizationId: string, dto: AddMemberDto) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new NotFoundException('Organization not found.');
      }
      const person = await tx.subject.findUnique({ where: { id: dto.personSubjectId } });
      if (!person) {
        throw new NotFoundException('Person subject not found.');
      }
      if (person.type !== 'PERSON') {
        throw new BadRequestException('Only a PERSON subject can be a member.');
      }

      const membership = await tx.organizationMembership.upsert({
        where: { organizationId_personSubjectId: { organizationId, personSubjectId: dto.personSubjectId } },
        update: { role: dto.role },
        create: {
          tenantId,
          organizationId,
          personSubjectId: dto.personSubjectId,
          role: dto.role,
          addedByApiKeyId: apiKeyId,
        },
      });

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'organization.add_member',
        subjectId: dto.personSubjectId,
      });

      return membership;
    });
  }

  async listMembers(tenantId: string, apiKeyId: string, organizationId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new NotFoundException('Organization not found.');
      }
      const members = await tx.organizationMembership.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      });

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'organization.members_list',
      });

      return members;
    });
  }
}
