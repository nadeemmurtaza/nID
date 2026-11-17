-- Tenant webhook secrets were stored in plaintext (webhookSecretPlaintext,
-- billingWebhookSecretPlaintext) because signing needs the real value. They are
-- now AES-256-GCM ciphertext in webhookSecretEnc / billingWebhookSecretEnc,
-- with the key held outside the database (see nid_shared_types::SecretBox).
--
-- Expand then contract in one migration: nid-api encrypts any existing
-- plaintext before the migrator runs (nid_db_schema::encrypt_legacy_webhook_secrets),
-- so by the time the plaintext columns are dropped below there is nothing left
-- in them. The guard makes that ordering a hard requirement: if a plaintext
-- value is still present the migration stops rather than destroy it.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "webhookSecretEnc" text;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "billingWebhookSecretEnc" text;

-- The platform tenant 'self' (migration 000005) is seeded with throwaway random
-- values and has no webhook URL, so nothing ever signs with them. Clear them
-- so a fresh database passes the guard below.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'webhookSecretPlaintext') THEN
    EXECUTE 'UPDATE "Tenant" SET "webhookSecretPlaintext" = NULL, "billingWebhookSecretPlaintext" = NULL WHERE id = ''self'' AND "webhookUrl" IS NULL AND "billingWebhookUrl" IS NULL';
  END IF;
END $$;

DO $$
DECLARE leftover bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'webhookSecretPlaintext') THEN
    EXECUTE 'SELECT count(*) FROM "Tenant" WHERE "webhookSecretPlaintext" IS NOT NULL OR "billingWebhookSecretPlaintext" IS NOT NULL' INTO leftover;
    IF leftover > 0 THEN
      RAISE EXCEPTION 'Tenant still holds plaintext webhook secrets. Start nid-api with WEBHOOK_SECRET_KEY set so it encrypts them before this migration runs.';
    END IF;
  END IF;
END $$;

DROP VIEW IF EXISTS tenant;
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "webhookSecretPlaintext";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "billingWebhookSecretPlaintext";

CREATE VIEW tenant AS
SELECT
    "id",
    "name",
    "slug",
    "dataResidencyRegion" AS data_residency_region,
    "webhookUrl" AS webhook_url,
    "webhookSecretEnc" AS webhook_secret_enc,
    "billingWebhookUrl" AS billing_webhook_url,
    "billingWebhookSecretEnc" AS billing_webhook_secret_enc,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
FROM "Tenant";
ALTER VIEW tenant SET (security_invoker = true);
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant TO nid_app;
