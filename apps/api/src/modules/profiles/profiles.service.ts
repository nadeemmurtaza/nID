import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nid/db';
import type { Account, Organization, Profile } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { CrossTenantBadgesService } from '../badges/cross-tenant-badges.service';
import { OrganizationsService } from '../organizations/organizations.service';
import type { Badge } from '../badges/badge-ranking';
import type { CreateProfileDto } from './dto/create-profile.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { isUsernameLocked, slugifyRealName, slugMatchesRealName } from './username';

/**
 * The fields a slug's public GET is allowed to reveal unconditionally —
 * never nationalIdNumber-grade PII, and never phone/whatsapp/publicEmail/
 * address, which are gated behind their own show* flag below.
 */
export interface PublicProfile {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  category: string;
  bio: string | null;
  photoKey: string | null;
  timezone: string;
  phone: string | null;
  whatsapp: string | null;
  publicEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  showBooking: boolean;
  showOffers: boolean;
  showHours: boolean;
  badges: Badge[] | null;
  /** The verified name behind the badges, never displayName's replacement — only present when the owner opts in via showRealName. */
  realName: string | null;
}

/**
 * Single-segment literal paths this controller (and BookingController,
 * sharing the same v1/profiles prefix) register below /v1/profiles/ — a
 * Profile whose slug equalled one of these would permanently shadow that
 * route for its own owner, since Nest/Express matches the literal route
 * first but a public GET at that exact path would never reach the
 * :slug handler either. Kept as its own module-level constant so every
 * new literal sub-route (booking.controller.ts's own /me/*) is a one-line
 * addition here, not a silent trap.
 */
const RESERVED_PROFILE_SLUGS = new Set(['me']);

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenantBadges: CrossTenantBadgesService,
    private readonly organizations: OrganizationsService,
  ) {}

  /**
   * "Username will be available for verified account only" + "will for
   * sure contain the realname in priority" — both gated here, before a
   * slug is ever reserved. Profile is 1:1 with Account (schema.prisma's
   * comment on it) — no RLS, so `unscoped` is correct.
   */
  async create(account: Account, dto: CreateProfileDto): Promise<Profile> {
    assertNotReservedSlug(dto.slug);
    const realNameSlug = await this.requireVerifiedRealName(account.phone);
    if (!slugMatchesRealName(dto.slug, realNameSlug)) {
      throw new BadRequestException(
        `Username must be based on your verified name ("${realNameSlug}", or "${realNameSlug}-..." for a qualifier).`,
      );
    }

    const existing = await this.prisma.unscoped.profile.findUnique({ where: { accountId: account.id } });
    if (existing) {
      throw new ConflictException('This account already has a profile.');
    }

    try {
      return await this.prisma.unscoped.profile.create({
        data: {
          accountId: account.id,
          slug: dto.slug,
          displayName: dto.displayName,
          usernameSetAt: new Date(),
          usernameSourceName: realNameSlug,
          ...toOptionalProfileFields(dto),
        },
      });
    } catch (err) {
      throw translateUniqueViolation(err);
    }
  }

  /**
   * Real cross-tenant identity verification, required before a username
   * can exist at all — an IDENTITY badge alone isn't enough on its own
   * (org_membership-style inheritance, or a REGISTRY_VERIFIED check with
   * no document, could produce one without ever recording a name), so
   * this also requires the actual PhoneNameEvidence row a real
   * document_ocr pass writes (see resolveCaseActivity's own comment).
   * Returns the slugified name a chosen username must be built from.
   */
  private async requireVerifiedRealName(phone: string): Promise<string> {
    const badges = await this.crossTenantBadges.getBadgesForPhone(phone);
    if (!badges.some((badge) => badge.claimType === 'IDENTITY')) {
      throw new ForbiddenException('Verify your identity before choosing a username.');
    }
    const name = await this.prisma.unscoped.phoneNameEvidence.findFirst({
      where: { phone },
      orderBy: { verifiedAt: 'desc' },
    });
    if (!name) {
      throw new ForbiddenException(
        'A verified government ID with your name on it is required before choosing a username.',
      );
    }
    return slugifyRealName(`${name.givenName} ${name.familyName}`);
  }

  async getMine(accountId: string): Promise<Profile> {
    const profile = await this.prisma.unscoped.profile.findUnique({ where: { accountId } });
    if (!profile) {
      throw new NotFoundException('No profile exists for this account yet.');
    }
    return profile;
  }

  async update(account: Account, dto: UpdateProfileDto): Promise<Profile> {
    const profile = await this.prisma.unscoped.profile.findUnique({ where: { accountId: account.id } });
    if (!profile) {
      throw new NotFoundException('No profile exists for this account yet.');
    }

    const slugChanged = dto.slug !== undefined && dto.slug !== profile.slug;
    let realNameSlug: string | undefined;
    if (slugChanged) {
      assertNotReservedSlug(dto.slug!);
      realNameSlug = await this.requireVerifiedRealName(account.phone);
      this.assertSlugChangeAllowed(profile, dto.slug!, realNameSlug, 'your verified name');
    }

    try {
      return await this.prisma.unscoped.profile.update({
        where: { accountId: account.id },
        data: {
          slug: dto.slug,
          displayName: dto.displayName,
          usernameSetAt: slugChanged ? new Date() : undefined,
          usernameSourceName: slugChanged ? realNameSlug : undefined,
          ...toOptionalProfileFields(dto),
        },
      });
    } catch (err) {
      throw translateUniqueViolation(err);
    }
  }

  /**
   * The rename half of the username gate — "user will be given a week if
   * he wants to reconsider, after 1 week username will become permanent
   * forever... user will be able to change only when he has changed his
   * realname in govt record." A verified name that no longer matches
   * usernameSourceName (the name the CURRENT slug was built from) IS that
   * govt-record-change signal — checked live against fresh evidence, never
   * a separate flag someone could forget to set. Reused by update() and
   * updateForOrganization(); create()/createForOrganization() have no
   * existing profile to lock against, so they never call this.
   */
  private assertSlugChangeAllowed(profile: Profile, newSlug: string, realNameSlug: string, subjectLabel: string): void {
    if (!slugMatchesRealName(newSlug, realNameSlug)) {
      throw new BadRequestException(
        `Username must be based on ${subjectLabel} ("${realNameSlug}", or "${realNameSlug}-..." for a qualifier).`,
      );
    }
    const nameChangedSinceLock = realNameSlug !== profile.usernameSourceName;
    if (!nameChangedSinceLock && isUsernameLocked(profile.usernameSetAt)) {
      throw new ForbiddenException(
        'This username is permanent. It can only be changed again if the verified name it was built from changes.',
      );
    }
  }

  /**
   * "Organization can manage and create only its own brand profiles with
   * proper verification" — never the org's own credential (it has none;
   * see Organization/OrganizationMembership's own schema comments), always
   * a person's own Account session, authorized by an ACTIVE + isAdmin
   * OrganizationMembership (OrganizationsService.requireActiveAdmin()) and
   * gated on the organization actually being real-KYB-verified
   * (getVerificationStatus() — the exact same derivation
   * organizations.service.ts's getById() itself uses, not a separate
   * assumption). One profile per Organization, the same 1:1 a personal
   * profile has per Account (Profile.organizationId's own @unique).
   */
  async createForOrganization(accountId: string, organizationId: string, dto: CreateProfileDto): Promise<Profile> {
    assertNotReservedSlug(dto.slug);
    const membership = await this.organizations.requireActiveAdmin(organizationId, accountId);
    const organization = await this.organizations.getVerified(membership.tenantId, organizationId);

    // Same "must derive from the real, verified name" rule as a personal
    // username — legalName here, not a self-chosen displayName, since
    // that's the one name this Organization's own KYB actually vouches
    // for (see OrganizationsService.getVerified()'s own comment).
    const realNameSlug = slugifyRealName(organization.legalName);
    if (!slugMatchesRealName(dto.slug, realNameSlug)) {
      throw new BadRequestException(
        `Username must be based on the organization's verified legal name ("${realNameSlug}", or "${realNameSlug}-..." for a qualifier).`,
      );
    }

    const existing = await this.prisma.unscoped.profile.findUnique({ where: { organizationId } });
    if (existing) {
      throw new ConflictException('This organization already has a profile.');
    }

    try {
      return await this.prisma.unscoped.profile.create({
        data: {
          organizationId,
          slug: dto.slug,
          displayName: dto.displayName,
          usernameSetAt: new Date(),
          usernameSourceName: realNameSlug,
          ...toOptionalProfileFields(dto),
        },
      });
    } catch (err) {
      throw translateUniqueViolation(err);
    }
  }

  /** The owner-editing view — same admin-membership check as createForOrganization(), never the public projection. */
  async getForOrganization(accountId: string, organizationId: string): Promise<Profile> {
    await this.organizations.requireActiveAdmin(organizationId, accountId);
    const profile = await this.prisma.unscoped.profile.findUnique({ where: { organizationId } });
    if (!profile) {
      throw new NotFoundException('No profile exists for this organization yet.');
    }
    return profile;
  }

  async updateForOrganization(accountId: string, organizationId: string, dto: UpdateProfileDto): Promise<Profile> {
    const membership = await this.organizations.requireActiveAdmin(organizationId, accountId);
    const profile = await this.prisma.unscoped.profile.findUnique({ where: { organizationId } });
    if (!profile) {
      throw new NotFoundException('No profile exists for this organization yet.');
    }

    const slugChanged = dto.slug !== undefined && dto.slug !== profile.slug;
    let realNameSlug: string | undefined;
    if (slugChanged) {
      assertNotReservedSlug(dto.slug!);
      const organization = await this.organizations.getVerified(membership.tenantId, organizationId);
      realNameSlug = slugifyRealName(organization.legalName);
      this.assertSlugChangeAllowed(profile, dto.slug!, realNameSlug, "the organization's verified legal name");
    }

    try {
      return await this.prisma.unscoped.profile.update({
        where: { organizationId },
        data: {
          slug: dto.slug,
          displayName: dto.displayName,
          usernameSetAt: slugChanged ? new Date() : undefined,
          usernameSourceName: slugChanged ? realNameSlug : undefined,
          ...toOptionalProfileFields(dto),
        },
      });
    } catch (err) {
      throw translateUniqueViolation(err);
    }
  }

  /**
   * Unauthenticated — apps/profile-ui's public /[slug] route. Never reveals
   * an unpublished profile (a draft the owner hasn't chosen to make public
   * yet is not a 404 vs 200 distinction the caller should be able to probe,
   * so both "no such slug" and "exists but unpublished" return 404).
   */
  async getPublicBySlug(slug: string): Promise<PublicProfile> {
    const profile = await this.prisma.unscoped.profile.findUnique({
      where: { slug },
      include: { account: true, organization: true },
    });
    if (!profile || !profile.isPublished) {
      throw new NotFoundException('No published profile at this URL.');
    }

    return this.toPublicProjection(profile, profile.account, profile.organization);
  }

  /**
   * A personal profile's badges are the Account's own cross-tenant
   * evidence (CrossTenantBadgesService, keyed by phone). A brand profile
   * has no phone at all — its one real fact is the Organization's own KYB
   * IDENTITY case, read live through the exact same derivation getById()
   * uses, not a separate assumption or a cached flag.
   */
  private async getBadges(account: Account | null, organization: Organization | null): Promise<Badge[]> {
    if (organization) {
      const verification = await this.organizations.getVerificationStatus(organization.tenantId, organization.id);
      if (!verification.isVerified || !verification.verifiedLevel) {
        return [];
      }
      return [
        {
          claimType: 'IDENTITY',
          level: verification.verifiedLevel,
          verifiedAt: verification.verifiedAt,
          caseId: verification.verifiedCaseId,
        },
      ];
    }
    // Every Profile has exactly one owner (the DB CHECK constraint this
    // table's migration adds) — organization null here means account
    // cannot be, but TypeScript can't see that invariant across the
    // nullable columns, so this stays an explicit assertion, not silent.
    if (!account) {
      throw new Error('Profile has neither an account nor an organization owner — data integrity violation.');
    }
    return this.crossTenantBadges.getBadgesForPhone(account.phone);
  }

  private async toPublicProjection(
    profile: Profile,
    account: Account | null,
    organization: Organization | null,
  ): Promise<PublicProfile> {
    const badges = profile.showBadges ? await this.getBadges(account, organization) : null;
    const realName = profile.showRealName ? await this.getRealName(account, organization) : null;

    return {
      id: profile.id,
      slug: profile.slug,
      displayName: profile.displayName,
      headline: profile.headline,
      category: profile.category,
      bio: profile.bio,
      photoKey: profile.photoKey,
      timezone: profile.timezone,
      phone: profile.showPhone ? profile.phone : null,
      whatsapp: profile.showWhatsapp ? profile.whatsapp : null,
      publicEmail: profile.showEmail ? profile.publicEmail : null,
      addressLine1: profile.showAddress ? profile.addressLine1 : null,
      addressLine2: profile.showAddress ? profile.addressLine2 : null,
      city: profile.showAddress ? profile.city : null,
      region: profile.showAddress ? profile.region : null,
      countryCode: profile.showAddress ? profile.countryCode : null,
      latitude: profile.showAddress ? profile.latitude : null,
      longitude: profile.showAddress ? profile.longitude : null,
      showBooking: profile.showBooking,
      showOffers: profile.showOffers,
      showHours: profile.showHours,
      badges,
      realName,
    };
  }

  /**
   * The verified name value itself (not the slugified form the username
   * gate uses) — resolved the exact same way requireVerifiedRealName()
   * (personal) / getVerified().legalName (brand) do, so what a viewer
   * sees here is never anything other than what the KYC evidence actually
   * says. Only ever called when the owner has explicitly opted in via
   * showRealName — "privacy 1st" means the default path never even
   * queries this.
   */
  private async getRealName(account: Account | null, organization: Organization | null): Promise<string | null> {
    if (organization) {
      return organization.legalName;
    }
    if (!account) {
      return null;
    }
    const name = await this.prisma.unscoped.phoneNameEvidence.findFirst({
      where: { phone: account.phone },
      orderBy: { verifiedAt: 'desc' },
    });
    return name ? `${name.givenName} ${name.familyName}` : null;
  }
}

/**
 * Every field an `undefined` value here — Prisma's create/update both treat
 * an `undefined` value in `data` as "not provided" (falls back to the
 * column's default on create, left untouched on update), the same
 * semantics a PATCH needs and exactly what an omitted optional DTO field
 * already is, so no conditional-spread bookkeeping is needed.
 */
function toOptionalProfileFields(dto: Omit<UpdateProfileDto, 'slug' | 'displayName'>) {
  return {
    headline: dto.headline,
    category: dto.category,
    bio: dto.bio,
    phone: dto.phone,
    whatsapp: dto.whatsapp,
    publicEmail: dto.publicEmail,
    addressLine1: dto.addressLine1,
    addressLine2: dto.addressLine2,
    city: dto.city,
    region: dto.region,
    countryCode: dto.countryCode,
    latitude: dto.latitude,
    longitude: dto.longitude,
    timezone: dto.timezone,
    showPhone: dto.showPhone,
    showWhatsapp: dto.showWhatsapp,
    showEmail: dto.showEmail,
    showAddress: dto.showAddress,
    showBadges: dto.showBadges,
    showBooking: dto.showBooking,
    showOffers: dto.showOffers,
    showHours: dto.showHours,
    showRealName: dto.showRealName,
    isPublished: dto.isPublished,
  };
}

function assertNotReservedSlug(slug: string): void {
  if (RESERVED_PROFILE_SLUGS.has(slug)) {
    throw new BadRequestException(`"${slug}" is a reserved URL and cannot be used as a profile slug.`);
  }
}

function translateUniqueViolation(err: unknown): Error {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return new ConflictException('That URL is already taken — choose a different slug.');
  }
  return err as Error;
}
