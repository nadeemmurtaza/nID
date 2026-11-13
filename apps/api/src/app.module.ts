import { Module } from '@nestjs/common';
import { PrismaModule } from './core/db/prisma.module';
import { AuditModule } from './core/audit/audit.module';
import { TemporalClientModule } from './core/temporal/temporal-client.module';
import { StorageModule } from './core/storage/storage.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { BrandsModule } from './modules/brands/brands.module';
import { TenantStaffModule } from './modules/tenant-staff/tenant-staff.module';
import { VerificationCasesModule } from './modules/verification-cases/verification-cases.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { OAuthModule } from './modules/oauth/oauth.module';
import { BadgesModule } from './modules/badges/badges.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { BookingModule } from './modules/booking/booking.module';
import { ProfileContentModule } from './modules/profile-content/profile-content.module';
import { AccessModule } from './modules/access/access.module';
import { DepartmentModule } from './modules/department/department.module';
import { RoleModule } from './modules/role/role.module';
import { InvitationModule } from './modules/invitation/invitation.module';
import { PermissionModule } from './modules/permission/permission.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    TemporalClientModule,
    StorageModule,
    TenantsModule,
    SubjectsModule,
    OrganizationsModule,
    BrandsModule,
    TenantStaffModule,
    VerificationCasesModule,
    SessionsModule,
    AccountsModule,
    OAuthModule,
    BadgesModule,
    ProfilesModule,
    BookingModule,
    ProfileContentModule,
    AccessModule,
    DepartmentModule,
    RoleModule,
    InvitationModule,
    PermissionModule,
  ],
})
export class AppModule {}
