-- "User can show only one specific info to only one person or
-- organization by his own will" — a private, single-recipient exception
-- to the owner's public show* defaults, which stay untouched for everyone
-- else. Revoked, never deleted (revokedAt IS NULL is "active"), and
-- constrained to exactly one grantee the same way Profile's own owner
-- column already is.
CREATE TYPE "ProfileGrantField" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL', 'ADDRESS', 'REAL_NAME');

CREATE TABLE "ProfileFieldGrant" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "field" "ProfileGrantField" NOT NULL,
    "granteeAccountId" TEXT,
    "granteeOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ProfileFieldGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfileFieldGrant_profileId_idx" ON "ProfileFieldGrant"("profileId");
CREATE INDEX "ProfileFieldGrant_granteeAccountId_idx" ON "ProfileFieldGrant"("granteeAccountId");
CREATE INDEX "ProfileFieldGrant_granteeOrganizationId_idx" ON "ProfileFieldGrant"("granteeOrganizationId");

ALTER TABLE "ProfileFieldGrant" ADD CONSTRAINT "ProfileFieldGrant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileFieldGrant" ADD CONSTRAINT "ProfileFieldGrant_granteeAccountId_fkey" FOREIGN KEY ("granteeAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileFieldGrant" ADD CONSTRAINT "ProfileFieldGrant_granteeOrganizationId_fkey" FOREIGN KEY ("granteeOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfileFieldGrant" ADD CONSTRAINT "ProfileFieldGrant_grantee_check" CHECK (("granteeAccountId" IS NOT NULL) <> ("granteeOrganizationId" IS NOT NULL));
