-- AUTO-GENERATED: assignment casts from text to every native Postgres
-- enum type Prisma created, so the Rust backend's plain-string binds
-- (sqlx sends them as `text`) can be inserted/updated into enum columns
-- without the backend needing to know about each Postgres enum type.

DO $$ BEGIN
  CREATE CAST (text AS "SubjectType") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "CaseStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "AttemptStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "AuditActorType") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "LoginRequestStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "ClaimType") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "VerificationLevel") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "ProfileCategory") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "Weekday") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "SocialPlatform") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "ProfileImageKind") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "AppointmentStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "AttributeType") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "MembershipStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "ProfileGrantField") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "BillingServiceStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "PlanMode") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "PlanInterval") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "PlanStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "BillingAccountStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "SubscriptionStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "InvoiceStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "PaymentIntentPurpose") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "PaymentIntentStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "PaymentStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "RefundStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "CheckoutSessionStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "CreditEntryReason") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "LedgerAccountKind") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "LedgerTransactionType") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "LedgerDirection") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "WebhookEventStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "SettlementStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "OutboundEventStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "AccessType") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "AccessGrantStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "InvitationStatus") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE CAST (text AS "AccessScope") WITH INOUT AS ASSIGNMENT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
