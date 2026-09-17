-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('IDENTITY', 'DATE_OF_BIRTH', 'EDUCATION', 'EMPLOYMENT');

-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('SELF_ATTESTED', 'DOCUMENT_VERIFIED', 'REGISTRY_VERIFIED');

-- AlterTable
ALTER TABLE "VerificationCase" ADD COLUMN     "claimType" "ClaimType" NOT NULL DEFAULT 'IDENTITY',
ADD COLUMN     "level" "VerificationLevel" NOT NULL DEFAULT 'SELF_ATTESTED';

-- AlterTable
ALTER TABLE "VerificationPolicy" ADD COLUMN     "claimType" "ClaimType" NOT NULL DEFAULT 'IDENTITY',
ADD COLUMN     "level" "VerificationLevel" NOT NULL DEFAULT 'SELF_ATTESTED';

-- CreateIndex
CREATE INDEX "VerificationCase_tenantId_subjectId_claimType_status_level_idx" ON "VerificationCase"("tenantId", "subjectId", "claimType", "status", "level");

-- CreateIndex
CREATE INDEX "VerificationPolicy_tenantId_claimType_idx" ON "VerificationPolicy"("tenantId", "claimType");
