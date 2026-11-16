-- Self-service verification: a person verifying themselves through the
-- Verification Center, not on behalf of a tenant, is filed under the
-- platform tenant 'self'. A case needs a policy (which methods run, at which
-- level); these are the same definitions packages/db/prisma/seed.ts gives
-- the demo tenants for each claim type. They are ordinary rows: edit or add
-- policies in this tenant to change what self-service offers.
INSERT INTO "Tenant" (id, name, slug, "webhookSecretPlaintext", "billingWebhookSecretPlaintext", "updatedAt")
VALUES ('self', 'nID personal accounts', 'self',
        md5(random()::text || clock_timestamp()::text),
        md5(random()::text || clock_timestamp()::text), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "VerificationPolicy" (id, "tenantId", name, methods, "claimType", level, "updatedAt")
SELECT gen_random_uuid()::text, 'self', v.name, v.methods, v.claim::"ClaimType", v.lvl::"VerificationLevel", now()
FROM (VALUES
  ('standard',            ARRAY['otp_sms'],                                'IDENTITY',      'SELF_ATTESTED'),
  ('kyc',                 ARRAY['otp_sms','document_ocr','liveness'],      'IDENTITY',      'DOCUMENT_VERIFIED'),
  ('dob-document',        ARRAY['dob_document'],                           'DATE_OF_BIRTH', 'DOCUMENT_VERIFIED'),
  ('education-document',  ARRAY['education_document'],                     'EDUCATION',     'DOCUMENT_VERIFIED'),
  ('education-registry',  ARRAY['education_registry'],                     'EDUCATION',     'REGISTRY_VERIFIED'),
  ('employment-document', ARRAY['employment_document'],                    'EMPLOYMENT',    'DOCUMENT_VERIFIED'),
  ('employment-registry', ARRAY['employment_registry'],                    'EMPLOYMENT',    'REGISTRY_VERIFIED')
) AS v(name, methods, claim, lvl)
WHERE NOT EXISTS (SELECT 1 FROM "VerificationPolicy" p WHERE p."tenantId" = 'self' AND p.name = v.name);
