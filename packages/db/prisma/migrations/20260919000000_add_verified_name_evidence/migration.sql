-- The real, verified name VALUE behind a phone — see PhoneNameEvidence's
-- own schema.prisma comment for why this is a genuinely new thing (neither
-- PhoneBadgeEvidence nor VerifiedAttribute store the actual fact, only
-- that a check happened and at what strength). Same no-RLS cross-tenant
-- trust domain as PhoneBadgeEvidence — this table holds nothing a single
-- tenant owns exclusively, only what a person's own Account needs to read
-- about itself across every tenant that's verified it.

CREATE TABLE "PhoneNameEvidence" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "givenName" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneNameEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhoneNameEvidence_phone_verifiedAt_idx" ON "PhoneNameEvidence"("phone", "verifiedAt");

-- VerificationMethodAttempt.raw: persists a method's completion result
-- detail durably — previously computed and discarded once a method
-- completed. See VerificationMethodAttempt's own schema.prisma comment.
ALTER TABLE "VerificationMethodAttempt" ADD COLUMN "raw" JSONB;
