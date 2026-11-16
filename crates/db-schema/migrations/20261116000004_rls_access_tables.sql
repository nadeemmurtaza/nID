-- Row-level security for the access-control tables that had none
-- (SECURITY_RULES.md item 2): they relied on application predicates alone.
-- Same convention as the rest of the schema: the application sets
-- app.tenant_id (and app.account_id for the caller) per transaction.

ALTER TABLE "AccessGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessGrant" FORCE ROW LEVEL SECURITY;
CREATE POLICY access_grant_tenant ON "AccessGrant" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY access_grant_own_account ON "AccessGrant" FOR SELECT
  USING ("accountId" = current_setting('app.account_id', true));

ALTER TABLE "RoleDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoleDefinition" FORCE ROW LEVEL SECURITY;
CREATE POLICY role_definition_tenant ON "RoleDefinition" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "RoleAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoleAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY role_assignment_tenant ON "RoleAssignment" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY role_assignment_own_account ON "RoleAssignment" FOR SELECT
  USING ("accountId" = current_setting('app.account_id', true));

ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" FORCE ROW LEVEL SECURITY;
CREATE POLICY department_tenant ON "Department" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "DepartmentAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DepartmentAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY department_assignment_tenant ON "DepartmentAssignment" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY department_assignment_own_account ON "DepartmentAssignment" FOR SELECT
  USING ("accountId" = current_setting('app.account_id', true));

-- Invitations are found by the invitee, who has no tenant context yet, so
-- reads are open (like the other lookup tables); writes stay tenant-scoped.
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" FORCE ROW LEVEL SECURITY;
CREATE POLICY invitation_lookup ON "Invitation" FOR SELECT USING (true);
CREATE POLICY invitation_insert_scoped ON "Invitation" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY invitation_update_scoped ON "Invitation" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY invitation_delete_scoped ON "Invitation" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Brand has no tenant column: it belongs to an organization. A caller may
-- touch a brand if they are an active member of its organization, or the
-- organization's tenant is the current tenant context.
ALTER TABLE "Brand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Brand" FORCE ROW LEVEL SECURITY;
CREATE POLICY brand_org_member ON "Brand" FOR ALL
  USING ("organizationId" IN (
    SELECT "organizationId" FROM "OrganizationMembership"
    WHERE "accountId" = current_setting('app.account_id', true) AND status = 'ACTIVE'))
  WITH CHECK ("organizationId" IN (
    SELECT "organizationId" FROM "OrganizationMembership"
    WHERE "accountId" = current_setting('app.account_id', true) AND status = 'ACTIVE'));
CREATE POLICY brand_tenant ON "Brand" FOR ALL
  USING ("organizationId" IN (SELECT id FROM "Organization" WHERE "tenantId" = current_setting('app.tenant_id', true)))
  WITH CHECK ("organizationId" IN (SELECT id FROM "Organization" WHERE "tenantId" = current_setting('app.tenant_id', true)));
