-- apps/rust-api and its DTOs read and write organization.address, but the
-- column never existed, so every organization create/read failed.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "address" text;

CREATE OR REPLACE VIEW organization AS
 SELECT id,
    "tenantId" AS tenant_id,
    "subjectId" AS subject_id,
    "legalName" AS legal_name,
    "registrationNumber" AS registration_number,
    "countryCode" AS country_code,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at,
    address
   FROM "Organization";

-- CREATE OR REPLACE VIEW resets view options, so this must be re-applied.
ALTER VIEW organization SET (security_invoker = true);
