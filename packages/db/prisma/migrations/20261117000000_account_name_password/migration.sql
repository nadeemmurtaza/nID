-- Detailed sign-up (name + password) alongside the existing passwordless
-- phone+OTP flow. password_hash is nullable: OTP-only accounts never set it.
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "passwordHash" text;

-- New columns must be appended after the existing ones: CREATE OR REPLACE
-- VIEW can't rename or reorder columns already exposed by this view.
CREATE OR REPLACE VIEW account AS
 SELECT id,
    phone,
    email,
    "phoneVerifiedAt" AS phone_verified_at,
    "emailVerifiedAt" AS email_verified_at,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at,
    name,
    "passwordHash" AS password_hash
   FROM "Account";

-- CREATE OR REPLACE VIEW resets view options, so this must be re-applied.
ALTER VIEW account SET (security_invoker = true);
