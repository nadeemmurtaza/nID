-- CreateTable
CREATE TABLE "PhoneBadgeEvidence" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "caseId" TEXT,
    "claimType" "ClaimType" NOT NULL,
    "level" "VerificationLevel" NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneBadgeEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneBadgeEvidence_phone_claimType_idx" ON "PhoneBadgeEvidence"("phone", "claimType");
