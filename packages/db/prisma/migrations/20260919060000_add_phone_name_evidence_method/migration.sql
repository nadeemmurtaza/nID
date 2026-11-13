-- Records which PASSED method produced each PhoneNameEvidence row, so the
-- username gate (profiles.service.ts's requireVerifiedRealName) can
-- require the stronger kind — a method that ties NATIONAL_ID_NUMBER and
-- PHONE together in one third-party check (today: estamp_registry), not
-- just "any name was ever read off a document." Backfilled to
-- 'document_ocr' because that was the only writer of this table before
-- this migration — a true statement about every existing row, not a
-- placeholder guess.
ALTER TABLE "PhoneNameEvidence" ADD COLUMN "method" TEXT;
UPDATE "PhoneNameEvidence" SET "method" = 'document_ocr' WHERE "method" IS NULL;
ALTER TABLE "PhoneNameEvidence" ALTER COLUMN "method" SET NOT NULL;
