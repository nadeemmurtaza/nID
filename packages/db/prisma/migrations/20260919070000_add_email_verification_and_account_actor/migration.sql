-- Real email verification (Verification Center) + an ACCOUNT audit actor
-- for self-service, Account-initiated verification cases.
ALTER TYPE "AuditActorType" ADD VALUE 'ACCOUNT';

ALTER TABLE "Account" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "AccountEmailOtpCode" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountEmailOtpCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountEmailOtpCode_accountId_idx" ON "AccountEmailOtpCode"("accountId");

ALTER TABLE "AccountEmailOtpCode" ADD CONSTRAINT "AccountEmailOtpCode_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
