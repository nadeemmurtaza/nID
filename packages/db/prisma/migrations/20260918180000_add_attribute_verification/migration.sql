-- Adds fine-grained, per-fact verification: a Subject's individual
-- real-world attributes (NAME, CNIC, PHONE, EMAIL, DATE_OF_BIRTH, ADDRESS)
-- can each be independently verified, by whichever method actually proved
-- them — one method can prove several attributes at once (e-stamp proves
-- NAME + CNIC + PHONE together). This is a genuinely separate, finer-
-- grained concept from VerificationCase.claimType/level, not a replacement
-- for it — see VerifiedAttribute's schema.prisma comment.

CREATE TYPE "AttributeType" AS ENUM ('NAME', 'CNIC', 'PHONE', 'EMAIL', 'DATE_OF_BIRTH', 'ADDRESS');

ALTER TABLE "Subject" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "Subject" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "Subject" ADD COLUMN "city" TEXT;
ALTER TABLE "Subject" ADD COLUMN "region" TEXT;
ALTER TABLE "Subject" ADD COLUMN "countryCode" TEXT;
ALTER TABLE "Subject" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Subject" ADD COLUMN "longitude" DOUBLE PRECISION;

CREATE TABLE "VerifiedAttribute" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL REFERENCES "Subject"("id") ON DELETE CASCADE,
    "attribute" "AttributeType" NOT NULL,
    "level" "VerificationLevel" NOT NULL,
    "method" TEXT NOT NULL,
    "caseId" TEXT NOT NULL REFERENCES "VerificationCase"("id") ON DELETE CASCADE,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "VerifiedAttribute_tenantId_idx" ON "VerifiedAttribute"("tenantId");
CREATE INDEX "VerifiedAttribute_tenantId_subjectId_attribute_idx" ON "VerifiedAttribute"("tenantId", "subjectId", "attribute");

ALTER TABLE "VerifiedAttribute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerifiedAttribute" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "VerifiedAttribute"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
