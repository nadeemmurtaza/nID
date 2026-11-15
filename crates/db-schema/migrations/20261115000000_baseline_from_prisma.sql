--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AccessGrantStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AccessGrantStatus" AS ENUM (
    'ACTIVE',
    'REVOKED',
    'PENDING'
);


--
-- Name: AccessScope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AccessScope" AS ENUM (
    'TENANT',
    'ORGANIZATION',
    'BRAND'
);


--
-- Name: AccessType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AccessType" AS ENUM (
    'OWNER',
    'PARTNER',
    'ADMIN',
    'MEMBER'
);


--
-- Name: AppointmentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AppointmentStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED'
);


--
-- Name: AttemptStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AttemptStatus" AS ENUM (
    'PENDING',
    'PASSED',
    'FAILED',
    'NEEDS_REVIEW'
);


--
-- Name: AttributeType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AttributeType" AS ENUM (
    'NAME',
    'NATIONAL_ID_NUMBER',
    'PHONE',
    'EMAIL',
    'DATE_OF_BIRTH',
    'ADDRESS'
);


--
-- Name: AuditActorType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AuditActorType" AS ENUM (
    'TENANT_STAFF',
    'SUBJECT',
    'SYSTEM',
    'API_KEY',
    'ACCOUNT',
    'SERVICE',
    'PLATFORM_ADMIN'
);


--
-- Name: BillingAccountStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BillingAccountStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'CLOSED'
);


--
-- Name: BillingServiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BillingServiceStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


--
-- Name: CaseStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CaseStatus" AS ENUM (
    'PENDING',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'NEEDS_REVIEW'
);


--
-- Name: CheckoutSessionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CheckoutSessionStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'EXPIRED',
    'CANCELED'
);


--
-- Name: ClaimType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ClaimType" AS ENUM (
    'IDENTITY',
    'DATE_OF_BIRTH',
    'EDUCATION',
    'EMPLOYMENT'
);


--
-- Name: CreditEntryReason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CreditEntryReason" AS ENUM (
    'TOPUP',
    'USAGE',
    'REFUND',
    'ADJUSTMENT'
);


--
-- Name: InvitationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvitationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'EXPIRED',
    'REVOKED'
);


--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'DRAFT',
    'OPEN',
    'PAID',
    'VOID',
    'UNCOLLECTIBLE'
);


--
-- Name: LedgerAccountKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LedgerAccountKind" AS ENUM (
    'PSP_CLEARING',
    'PSP_FEES',
    'REVENUE',
    'TAX_PAYABLE',
    'DEFERRED_REVENUE',
    'CUSTOMER_CREDITS',
    'REFUNDS',
    'ADJUSTMENTS'
);


--
-- Name: LedgerDirection; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LedgerDirection" AS ENUM (
    'DEBIT',
    'CREDIT'
);


--
-- Name: LedgerTransactionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LedgerTransactionType" AS ENUM (
    'PAYMENT',
    'CREDIT_TOPUP',
    'CREDIT_USAGE',
    'FEE',
    'REFUND',
    'RECOGNITION',
    'ADJUSTMENT'
);


--
-- Name: LoginRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LoginRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'EXPIRED'
);


--
-- Name: MembershipStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MembershipStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'DECLINED'
);


--
-- Name: OutboundEventStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OutboundEventStatus" AS ENUM (
    'PENDING',
    'DELIVERED',
    'FAILED'
);


--
-- Name: PaymentIntentPurpose; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentIntentPurpose" AS ENUM (
    'CREDIT_TOPUP',
    'SUBSCRIPTION',
    'INVOICE',
    'ONE_OFF'
);


--
-- Name: PaymentIntentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentIntentStatus" AS ENUM (
    'REQUIRES_CHECKOUT',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'EXPIRED',
    'CANCELED'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'SUCCEEDED',
    'FAILED'
);


--
-- Name: PlanInterval; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlanInterval" AS ENUM (
    'MONTH',
    'YEAR'
);


--
-- Name: PlanMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlanMode" AS ENUM (
    'CREDIT_PACK',
    'SUBSCRIPTION',
    'ONE_OFF'
);


--
-- Name: PlanStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlanStatus" AS ENUM (
    'ACTIVE',
    'ARCHIVED'
);


--
-- Name: ProfileCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProfileCategory" AS ENUM (
    'DOCTOR',
    'BUSINESS',
    'PROFESSIONAL',
    'OTHER'
);


--
-- Name: ProfileGrantField; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProfileGrantField" AS ENUM (
    'PHONE',
    'WHATSAPP',
    'EMAIL',
    'ADDRESS',
    'REAL_NAME'
);


--
-- Name: ProfileImageKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProfileImageKind" AS ENUM (
    'BANNER',
    'GALLERY'
);


--
-- Name: RefundStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RefundStatus" AS ENUM (
    'PENDING',
    'SUCCEEDED',
    'FAILED'
);


--
-- Name: SettlementStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SettlementStatus" AS ENUM (
    'MATCHED',
    'DISCREPANCY'
);


--
-- Name: SocialPlatform; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SocialPlatform" AS ENUM (
    'FACEBOOK',
    'INSTAGRAM',
    'LINKEDIN',
    'TWITTER',
    'YOUTUBE',
    'TIKTOK',
    'OTHER'
);


--
-- Name: SubjectType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubjectType" AS ENUM (
    'PERSON',
    'ORGANIZATION'
);


--
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'INCOMPLETE',
    'ACTIVE',
    'PAST_DUE',
    'CANCELED'
);


--
-- Name: VerificationLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."VerificationLevel" AS ENUM (
    'SELF_ATTESTED',
    'DOCUMENT_VERIFIED',
    'REGISTRY_VERIFIED'
);


--
-- Name: WebhookEventStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WebhookEventStatus" AS ENUM (
    'RECEIVED',
    'PROCESSED',
    'IGNORED',
    'FAILED'
);


--
-- Name: Weekday; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Weekday" AS ENUM (
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY'
);


--
-- Name: CAST (text AS public."AccessGrantStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."AccessGrantStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."AccessScope"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."AccessScope") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."AccessType"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."AccessType") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."AppointmentStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."AppointmentStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."AttemptStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."AttemptStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."AttributeType"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."AttributeType") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."AuditActorType"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."AuditActorType") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."BillingAccountStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."BillingAccountStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."BillingServiceStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."BillingServiceStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."CaseStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."CaseStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."CheckoutSessionStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."CheckoutSessionStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."ClaimType"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."ClaimType") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."CreditEntryReason"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."CreditEntryReason") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."InvitationStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."InvitationStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."InvoiceStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."InvoiceStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."LedgerAccountKind"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."LedgerAccountKind") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."LedgerDirection"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."LedgerDirection") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."LedgerTransactionType"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."LedgerTransactionType") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."LoginRequestStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."LoginRequestStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."MembershipStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."MembershipStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."OutboundEventStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."OutboundEventStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."PaymentIntentPurpose"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."PaymentIntentPurpose") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."PaymentIntentStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."PaymentIntentStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."PaymentStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."PaymentStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."PlanInterval"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."PlanInterval") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."PlanMode"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."PlanMode") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."PlanStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."PlanStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."ProfileCategory"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."ProfileCategory") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."ProfileGrantField"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."ProfileGrantField") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."ProfileImageKind"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."ProfileImageKind") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."RefundStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."RefundStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."SettlementStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."SettlementStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."SocialPlatform"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."SocialPlatform") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."SubjectType"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."SubjectType") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."SubscriptionStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."SubscriptionStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."VerificationLevel"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."VerificationLevel") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."WebhookEventStatus"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."WebhookEventStatus") WITH INOUT AS ASSIGNMENT;


--
-- Name: CAST (text AS public."Weekday"); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS public."Weekday") WITH INOUT AS ASSIGNMENT;


--
-- Name: tg_access_grant_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_access_grant_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "AccessGrant" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_access_grant_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_access_grant_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "AccessGrant" ("id", "accountId", "tenantId", "organizationId", "brandId", "accessType", "partnershipPercentage", "grantedBy", "status", "grantedAt") VALUES (NEW.id, NEW.account_id, NEW.tenant_id, NEW.organization_id, NEW.brand_id, NEW.access_type::"AccessType", NEW.partnership_percentage, NEW.granted_by, NEW.status::"AccessGrantStatus", NEW.granted_at)
    RETURNING "id", "accountId", "tenantId", "organizationId", "brandId", "accessType"::text, "partnershipPercentage", "grantedBy", "status"::text, "grantedAt" INTO NEW.id, NEW.account_id, NEW.tenant_id, NEW.organization_id, NEW.brand_id, NEW.access_type, NEW.partnership_percentage, NEW.granted_by, NEW.status, NEW.granted_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_access_grant_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_access_grant_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "AccessGrant" SET "accountId" = NEW.account_id, "tenantId" = NEW.tenant_id, "organizationId" = NEW.organization_id, "brandId" = NEW.brand_id, "accessType" = NEW.access_type::"AccessType", "partnershipPercentage" = NEW.partnership_percentage, "grantedBy" = NEW.granted_by, "status" = NEW.status::"AccessGrantStatus", "grantedAt" = NEW.granted_at WHERE "id" = OLD.id
    RETURNING "id", "accountId", "tenantId", "organizationId", "brandId", "accessType"::text, "partnershipPercentage", "grantedBy", "status"::text, "grantedAt" INTO NEW.id, NEW.account_id, NEW.tenant_id, NEW.organization_id, NEW.brand_id, NEW.access_type, NEW.partnership_percentage, NEW.granted_by, NEW.status, NEW.granted_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_appointment_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_appointment_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "Appointment" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_appointment_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_appointment_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "Appointment" ("id", "profileId", "serviceId", "status", "startsAt", "endsAt", "visitorName", "visitorPhone", "visitorEmail", "notes", "createdAt", "updatedAt") VALUES (NEW.id, NEW.profile_id, NEW.service_id, NEW.status::"AppointmentStatus", NEW.starts_at, NEW.ends_at, NEW.visitor_name, NEW.visitor_phone, NEW.visitor_email, NEW.notes, NEW.created_at, NEW.updated_at)
    RETURNING "id", "profileId", "serviceId", "status"::text, "startsAt", "endsAt", "visitorName", "visitorPhone", "visitorEmail", "notes", "createdAt", "updatedAt" INTO NEW.id, NEW.profile_id, NEW.service_id, NEW.status, NEW.starts_at, NEW.ends_at, NEW.visitor_name, NEW.visitor_phone, NEW.visitor_email, NEW.notes, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_appointment_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_appointment_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Appointment" SET "profileId" = NEW.profile_id, "serviceId" = NEW.service_id, "status" = NEW.status::"AppointmentStatus", "startsAt" = NEW.starts_at, "endsAt" = NEW.ends_at, "visitorName" = NEW.visitor_name, "visitorPhone" = NEW.visitor_phone, "visitorEmail" = NEW.visitor_email, "notes" = NEW.notes, "createdAt" = NEW.created_at, "updatedAt" = NEW.updated_at WHERE "id" = OLD.id
    RETURNING "id", "profileId", "serviceId", "status"::text, "startsAt", "endsAt", "visitorName", "visitorPhone", "visitorEmail", "notes", "createdAt", "updatedAt" INTO NEW.id, NEW.profile_id, NEW.service_id, NEW.status, NEW.starts_at, NEW.ends_at, NEW.visitor_name, NEW.visitor_phone, NEW.visitor_email, NEW.notes, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_audit_log_entry_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_audit_log_entry_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "AuditLogEntry" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_audit_log_entry_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_audit_log_entry_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "AuditLogEntry" ("id", "tenantId", "actorType", "actorId", "action", "subjectId", "caseId", "ipAddress", "entityType", "entityId", "metadata", "createdAt") VALUES (NEW.id, NEW.tenant_id, NEW.actor_type::"AuditActorType", NEW.actor_id, NEW.action, NEW.subject_id, NEW.case_id, NEW.ip_address, NEW.entity_type, NEW.entity_id, NEW.metadata, NEW.created_at)
    RETURNING "id", "tenantId", "actorType"::text, "actorId", "action", "subjectId", "caseId", "ipAddress", "entityType", "entityId", "metadata", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.actor_type, NEW.actor_id, NEW.action, NEW.subject_id, NEW.case_id, NEW.ip_address, NEW.entity_type, NEW.entity_id, NEW.metadata, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_audit_log_entry_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_audit_log_entry_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "AuditLogEntry" SET "tenantId" = NEW.tenant_id, "actorType" = NEW.actor_type::"AuditActorType", "actorId" = NEW.actor_id, "action" = NEW.action, "subjectId" = NEW.subject_id, "caseId" = NEW.case_id, "ipAddress" = NEW.ip_address, "entityType" = NEW.entity_type, "entityId" = NEW.entity_id, "metadata" = NEW.metadata, "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "actorType"::text, "actorId", "action", "subjectId", "caseId", "ipAddress", "entityType", "entityId", "metadata", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.actor_type, NEW.actor_id, NEW.action, NEW.subject_id, NEW.case_id, NEW.ip_address, NEW.entity_type, NEW.entity_id, NEW.metadata, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_availability_rule_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_availability_rule_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "AvailabilityRule" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_availability_rule_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_availability_rule_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "AvailabilityRule" ("id", "profileId", "day", "startMinute", "endMinute", "isActive") VALUES (NEW.id, NEW.profile_id, NEW.day::"Weekday", NEW.start_minute, NEW.end_minute, NEW.is_active)
    RETURNING "id", "profileId", "day"::text, "startMinute", "endMinute", "isActive" INTO NEW.id, NEW.profile_id, NEW.day, NEW.start_minute, NEW.end_minute, NEW.is_active;
  RETURN NEW;
END;
$$;


--
-- Name: tg_availability_rule_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_availability_rule_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "AvailabilityRule" SET "profileId" = NEW.profile_id, "day" = NEW.day::"Weekday", "startMinute" = NEW.start_minute, "endMinute" = NEW.end_minute, "isActive" = NEW.is_active WHERE "id" = OLD.id
    RETURNING "id", "profileId", "day"::text, "startMinute", "endMinute", "isActive" INTO NEW.id, NEW.profile_id, NEW.day, NEW.start_minute, NEW.end_minute, NEW.is_active;
  RETURN NEW;
END;
$$;


--
-- Name: tg_billing_account_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_billing_account_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "BillingAccount" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_billing_account_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_billing_account_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "BillingAccount" ("id", "tenantId", "currency", "status", "creditBalanceMinor", "createdAt", "updatedAt") VALUES (NEW.id, NEW.tenant_id, NEW.currency, NEW.status::"BillingAccountStatus", NEW.credit_balance_minor, NEW.created_at, NEW.updated_at)
    RETURNING "id", "tenantId", "currency", "status"::text, "creditBalanceMinor", "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.currency, NEW.status, NEW.credit_balance_minor, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_billing_account_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_billing_account_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "BillingAccount" SET "tenantId" = NEW.tenant_id, "currency" = NEW.currency, "status" = NEW.status::"BillingAccountStatus", "creditBalanceMinor" = NEW.credit_balance_minor, "createdAt" = NEW.created_at, "updatedAt" = NEW.updated_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "currency", "status"::text, "creditBalanceMinor", "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.currency, NEW.status, NEW.credit_balance_minor, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_billing_service_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_billing_service_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "BillingService" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_billing_service_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_billing_service_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "BillingService" ("id", "key", "name", "ownerRepo", "status", "createdAt", "updatedAt") VALUES (NEW.id, NEW.key, NEW.name, NEW.owner_repo, NEW.status::"BillingServiceStatus", NEW.created_at, NEW.updated_at)
    RETURNING "id", "key", "name", "ownerRepo", "status"::text, "createdAt", "updatedAt" INTO NEW.id, NEW.key, NEW.name, NEW.owner_repo, NEW.status, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_billing_service_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_billing_service_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "BillingService" SET "key" = NEW.key, "name" = NEW.name, "ownerRepo" = NEW.owner_repo, "status" = NEW.status::"BillingServiceStatus", "createdAt" = NEW.created_at, "updatedAt" = NEW.updated_at WHERE "id" = OLD.id
    RETURNING "id", "key", "name", "ownerRepo", "status"::text, "createdAt", "updatedAt" INTO NEW.id, NEW.key, NEW.name, NEW.owner_repo, NEW.status, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_business_hour_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_business_hour_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "BusinessHour" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_business_hour_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_business_hour_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "BusinessHour" ("id", "profileId", "day", "openMinute", "closeMinute", "isClosed") VALUES (NEW.id, NEW.profile_id, NEW.day::"Weekday", NEW.open_minute, NEW.close_minute, NEW.is_closed)
    RETURNING "id", "profileId", "day"::text, "openMinute", "closeMinute", "isClosed" INTO NEW.id, NEW.profile_id, NEW.day, NEW.open_minute, NEW.close_minute, NEW.is_closed;
  RETURN NEW;
END;
$$;


--
-- Name: tg_business_hour_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_business_hour_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "BusinessHour" SET "profileId" = NEW.profile_id, "day" = NEW.day::"Weekday", "openMinute" = NEW.open_minute, "closeMinute" = NEW.close_minute, "isClosed" = NEW.is_closed WHERE "id" = OLD.id
    RETURNING "id", "profileId", "day"::text, "openMinute", "closeMinute", "isClosed" INTO NEW.id, NEW.profile_id, NEW.day, NEW.open_minute, NEW.close_minute, NEW.is_closed;
  RETURN NEW;
END;
$$;


--
-- Name: tg_checkout_session_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_checkout_session_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "CheckoutSession" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_checkout_session_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_checkout_session_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "CheckoutSession" ("id", "tenantId", "paymentIntentId", "tokenHash", "status", "returnUrl", "expiresAt", "consumedAt", "createdAt") VALUES (NEW.id, NEW.tenant_id, NEW.payment_intent_id, NEW.token_hash, NEW.status::"CheckoutSessionStatus", NEW.return_url, NEW.expires_at, NEW.consumed_at, NEW.created_at)
    RETURNING "id", "tenantId", "paymentIntentId", "tokenHash", "status"::text, "returnUrl", "expiresAt", "consumedAt", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.payment_intent_id, NEW.token_hash, NEW.status, NEW.return_url, NEW.expires_at, NEW.consumed_at, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_checkout_session_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_checkout_session_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "CheckoutSession" SET "tenantId" = NEW.tenant_id, "paymentIntentId" = NEW.payment_intent_id, "tokenHash" = NEW.token_hash, "status" = NEW.status::"CheckoutSessionStatus", "returnUrl" = NEW.return_url, "expiresAt" = NEW.expires_at, "consumedAt" = NEW.consumed_at, "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "paymentIntentId", "tokenHash", "status"::text, "returnUrl", "expiresAt", "consumedAt", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.payment_intent_id, NEW.token_hash, NEW.status, NEW.return_url, NEW.expires_at, NEW.consumed_at, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_credit_ledger_entry_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_credit_ledger_entry_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "CreditLedgerEntry" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_credit_ledger_entry_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_credit_ledger_entry_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "CreditLedgerEntry" ("id", "tenantId", "billingAccountId", "deltaMinor", "reason", "refType", "refId", "balanceAfterMinor", "createdAt") VALUES (NEW.id, NEW.tenant_id, NEW.billing_account_id, NEW.delta_minor, NEW.reason::"CreditEntryReason", NEW.ref_type, NEW.ref_id, NEW.balance_after_minor, NEW.created_at)
    RETURNING "id", "tenantId", "billingAccountId", "deltaMinor", "reason"::text, "refType", "refId", "balanceAfterMinor", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.billing_account_id, NEW.delta_minor, NEW.reason, NEW.ref_type, NEW.ref_id, NEW.balance_after_minor, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_credit_ledger_entry_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_credit_ledger_entry_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "CreditLedgerEntry" SET "tenantId" = NEW.tenant_id, "billingAccountId" = NEW.billing_account_id, "deltaMinor" = NEW.delta_minor, "reason" = NEW.reason::"CreditEntryReason", "refType" = NEW.ref_type, "refId" = NEW.ref_id, "balanceAfterMinor" = NEW.balance_after_minor, "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "billingAccountId", "deltaMinor", "reason"::text, "refType", "refId", "balanceAfterMinor", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.billing_account_id, NEW.delta_minor, NEW.reason, NEW.ref_type, NEW.ref_id, NEW.balance_after_minor, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_department_assignment_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_department_assignment_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "DepartmentAssignment" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_department_assignment_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_department_assignment_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "DepartmentAssignment" ("id", "accountId", "departmentId", "tenantId", "organizationId", "brandId", "scope", "createdAt") VALUES (NEW.id, NEW.account_id, NEW.department_id, NEW.tenant_id, NEW.organization_id, NEW.brand_id, NEW.scope::"AccessScope", NEW.created_at)
    RETURNING "id", "accountId", "departmentId", "tenantId", "organizationId", "brandId", "scope"::text, "createdAt" INTO NEW.id, NEW.account_id, NEW.department_id, NEW.tenant_id, NEW.organization_id, NEW.brand_id, NEW.scope, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_department_assignment_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_department_assignment_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "DepartmentAssignment" SET "accountId" = NEW.account_id, "departmentId" = NEW.department_id, "tenantId" = NEW.tenant_id, "organizationId" = NEW.organization_id, "brandId" = NEW.brand_id, "scope" = NEW.scope::"AccessScope", "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "accountId", "departmentId", "tenantId", "organizationId", "brandId", "scope"::text, "createdAt" INTO NEW.id, NEW.account_id, NEW.department_id, NEW.tenant_id, NEW.organization_id, NEW.brand_id, NEW.scope, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_invitation_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_invitation_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "Invitation" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_invitation_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_invitation_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "Invitation" ("id", "tenantId", "email", "username", "invitedBy", "organizationId", "brandId", "scope", "roleDefinitionId", "departmentId", "status", "expiresAt", "acceptedAt", "acceptedBy", "createdAt") VALUES (NEW.id, NEW.tenant_id, NEW.email, NEW.username, NEW.invited_by, NEW.organization_id, NEW.brand_id, NEW.scope::"AccessScope", NEW.role_definition_id, NEW.department_id, NEW.status::"InvitationStatus", NEW.expires_at, NEW.accepted_at, NEW.accepted_by, NEW.created_at)
    RETURNING "id", "tenantId", "email", "username", "invitedBy", "organizationId", "brandId", "scope"::text, "roleDefinitionId", "departmentId", "status"::text, "expiresAt", "acceptedAt", "acceptedBy", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.email, NEW.username, NEW.invited_by, NEW.organization_id, NEW.brand_id, NEW.scope, NEW.role_definition_id, NEW.department_id, NEW.status, NEW.expires_at, NEW.accepted_at, NEW.accepted_by, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_invitation_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_invitation_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Invitation" SET "tenantId" = NEW.tenant_id, "email" = NEW.email, "username" = NEW.username, "invitedBy" = NEW.invited_by, "organizationId" = NEW.organization_id, "brandId" = NEW.brand_id, "scope" = NEW.scope::"AccessScope", "roleDefinitionId" = NEW.role_definition_id, "departmentId" = NEW.department_id, "status" = NEW.status::"InvitationStatus", "expiresAt" = NEW.expires_at, "acceptedAt" = NEW.accepted_at, "acceptedBy" = NEW.accepted_by, "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "email", "username", "invitedBy", "organizationId", "brandId", "scope"::text, "roleDefinitionId", "departmentId", "status"::text, "expiresAt", "acceptedAt", "acceptedBy", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.email, NEW.username, NEW.invited_by, NEW.organization_id, NEW.brand_id, NEW.scope, NEW.role_definition_id, NEW.department_id, NEW.status, NEW.expires_at, NEW.accepted_at, NEW.accepted_by, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_invoice_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_invoice_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "Invoice" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_invoice_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_invoice_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "Invoice" ("id", "tenantId", "billingAccountId", "number", "status", "currency", "subtotalMinor", "taxMinor", "totalMinor", "amountPaidMinor", "periodStart", "periodEnd", "dueAt", "issuedAt", "paidAt", "voidedAt", "createdAt", "updatedAt") VALUES (NEW.id, NEW.tenant_id, NEW.billing_account_id, NEW.number, NEW.status::"InvoiceStatus", NEW.currency, NEW.subtotal_minor, NEW.tax_minor, NEW.total_minor, NEW.amount_paid_minor, NEW.period_start, NEW.period_end, NEW.due_at, NEW.issued_at, NEW.paid_at, NEW.voided_at, NEW.created_at, NEW.updated_at)
    RETURNING "id", "tenantId", "billingAccountId", "number", "status"::text, "currency", "subtotalMinor", "taxMinor", "totalMinor", "amountPaidMinor", "periodStart", "periodEnd", "dueAt", "issuedAt", "paidAt", "voidedAt", "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.billing_account_id, NEW.number, NEW.status, NEW.currency, NEW.subtotal_minor, NEW.tax_minor, NEW.total_minor, NEW.amount_paid_minor, NEW.period_start, NEW.period_end, NEW.due_at, NEW.issued_at, NEW.paid_at, NEW.voided_at, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_invoice_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_invoice_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Invoice" SET "tenantId" = NEW.tenant_id, "billingAccountId" = NEW.billing_account_id, "number" = NEW.number, "status" = NEW.status::"InvoiceStatus", "currency" = NEW.currency, "subtotalMinor" = NEW.subtotal_minor, "taxMinor" = NEW.tax_minor, "totalMinor" = NEW.total_minor, "amountPaidMinor" = NEW.amount_paid_minor, "periodStart" = NEW.period_start, "periodEnd" = NEW.period_end, "dueAt" = NEW.due_at, "issuedAt" = NEW.issued_at, "paidAt" = NEW.paid_at, "voidedAt" = NEW.voided_at, "createdAt" = NEW.created_at, "updatedAt" = NEW.updated_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "billingAccountId", "number", "status"::text, "currency", "subtotalMinor", "taxMinor", "totalMinor", "amountPaidMinor", "periodStart", "periodEnd", "dueAt", "issuedAt", "paidAt", "voidedAt", "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.billing_account_id, NEW.number, NEW.status, NEW.currency, NEW.subtotal_minor, NEW.tax_minor, NEW.total_minor, NEW.amount_paid_minor, NEW.period_start, NEW.period_end, NEW.due_at, NEW.issued_at, NEW.paid_at, NEW.voided_at, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_ledger_account_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_ledger_account_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "LedgerAccount" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_ledger_account_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_ledger_account_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "LedgerAccount" ("id", "tenantId", "serviceId", "kind", "currency", "scopeKey", "createdAt") VALUES (NEW.id, NEW.tenant_id, NEW.service_id, NEW.kind::"LedgerAccountKind", NEW.currency, NEW.scope_key, NEW.created_at)
    RETURNING "id", "tenantId", "serviceId", "kind"::text, "currency", "scopeKey", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.service_id, NEW.kind, NEW.currency, NEW.scope_key, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_ledger_account_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_ledger_account_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "LedgerAccount" SET "tenantId" = NEW.tenant_id, "serviceId" = NEW.service_id, "kind" = NEW.kind::"LedgerAccountKind", "currency" = NEW.currency, "scopeKey" = NEW.scope_key, "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "serviceId", "kind"::text, "currency", "scopeKey", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.service_id, NEW.kind, NEW.currency, NEW.scope_key, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_ledger_entry_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_ledger_entry_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "LedgerEntry" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_ledger_entry_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_ledger_entry_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "LedgerEntry" ("id", "tenantId", "transactionId", "accountId", "direction", "amountMinor") VALUES (NEW.id, NEW.tenant_id, NEW.transaction_id, NEW.account_id, NEW.direction::"LedgerDirection", NEW.amount_minor)
    RETURNING "id", "tenantId", "transactionId", "accountId", "direction"::text, "amountMinor" INTO NEW.id, NEW.tenant_id, NEW.transaction_id, NEW.account_id, NEW.direction, NEW.amount_minor;
  RETURN NEW;
END;
$$;


--
-- Name: tg_ledger_entry_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_ledger_entry_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "LedgerEntry" SET "tenantId" = NEW.tenant_id, "transactionId" = NEW.transaction_id, "accountId" = NEW.account_id, "direction" = NEW.direction::"LedgerDirection", "amountMinor" = NEW.amount_minor WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "transactionId", "accountId", "direction"::text, "amountMinor" INTO NEW.id, NEW.tenant_id, NEW.transaction_id, NEW.account_id, NEW.direction, NEW.amount_minor;
  RETURN NEW;
END;
$$;


--
-- Name: tg_ledger_transaction_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_ledger_transaction_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "LedgerTransaction" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_ledger_transaction_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_ledger_transaction_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "LedgerTransaction" ("id", "tenantId", "type", "refType", "refId", "currency", "occurredAt", "createdAt") VALUES (NEW.id, NEW.tenant_id, NEW.type::"LedgerTransactionType", NEW.ref_type, NEW.ref_id, NEW.currency, NEW.occurred_at, NEW.created_at)
    RETURNING "id", "tenantId", "type"::text, "refType", "refId", "currency", "occurredAt", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.type, NEW.ref_type, NEW.ref_id, NEW.currency, NEW.occurred_at, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_ledger_transaction_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_ledger_transaction_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "LedgerTransaction" SET "tenantId" = NEW.tenant_id, "type" = NEW.type::"LedgerTransactionType", "refType" = NEW.ref_type, "refId" = NEW.ref_id, "currency" = NEW.currency, "occurredAt" = NEW.occurred_at, "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "type"::text, "refType", "refId", "currency", "occurredAt", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.type, NEW.ref_type, NEW.ref_id, NEW.currency, NEW.occurred_at, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_oauth_login_request_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_oauth_login_request_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "OAuthLoginRequest" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_oauth_login_request_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_oauth_login_request_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "OAuthLoginRequest" ("id", "tenantId", "clientId", "redirectUri", "state", "status", "accountId", "pollTokenHash", "codeHash", "codeConsumedAt", "createdAt", "expiresAt") VALUES (NEW.id, NEW.tenant_id, NEW.client_id, NEW.redirect_uri, NEW.state, NEW.status::"LoginRequestStatus", NEW.account_id, NEW.poll_token_hash, NEW.code_hash, NEW.code_consumed_at, NEW.created_at, NEW.expires_at)
    RETURNING "id", "tenantId", "clientId", "redirectUri", "state", "status"::text, "accountId", "pollTokenHash", "codeHash", "codeConsumedAt", "createdAt", "expiresAt" INTO NEW.id, NEW.tenant_id, NEW.client_id, NEW.redirect_uri, NEW.state, NEW.status, NEW.account_id, NEW.poll_token_hash, NEW.code_hash, NEW.code_consumed_at, NEW.created_at, NEW.expires_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_oauth_login_request_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_oauth_login_request_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "OAuthLoginRequest" SET "tenantId" = NEW.tenant_id, "clientId" = NEW.client_id, "redirectUri" = NEW.redirect_uri, "state" = NEW.state, "status" = NEW.status::"LoginRequestStatus", "accountId" = NEW.account_id, "pollTokenHash" = NEW.poll_token_hash, "codeHash" = NEW.code_hash, "codeConsumedAt" = NEW.code_consumed_at, "createdAt" = NEW.created_at, "expiresAt" = NEW.expires_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "clientId", "redirectUri", "state", "status"::text, "accountId", "pollTokenHash", "codeHash", "codeConsumedAt", "createdAt", "expiresAt" INTO NEW.id, NEW.tenant_id, NEW.client_id, NEW.redirect_uri, NEW.state, NEW.status, NEW.account_id, NEW.poll_token_hash, NEW.code_hash, NEW.code_consumed_at, NEW.created_at, NEW.expires_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_organization_membership_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_organization_membership_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "OrganizationMembership" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_organization_membership_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_organization_membership_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "OrganizationMembership" ("id", "tenantId", "organizationId", "personSubjectId", "role", "status", "isAdmin", "accountId", "addedByApiKeyId", "createdAt", "respondedAt") VALUES (NEW.id, NEW.tenant_id, NEW.organization_id, NEW.person_subject_id, NEW.role, NEW.status::"MembershipStatus", NEW.is_admin, NEW.account_id, NEW.added_by_api_key_id, NEW.created_at, NEW.responded_at)
    RETURNING "id", "tenantId", "organizationId", "personSubjectId", "role", "status"::text, "isAdmin", "accountId", "addedByApiKeyId", "createdAt", "respondedAt" INTO NEW.id, NEW.tenant_id, NEW.organization_id, NEW.person_subject_id, NEW.role, NEW.status, NEW.is_admin, NEW.account_id, NEW.added_by_api_key_id, NEW.created_at, NEW.responded_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_organization_membership_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_organization_membership_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "OrganizationMembership" SET "tenantId" = NEW.tenant_id, "organizationId" = NEW.organization_id, "personSubjectId" = NEW.person_subject_id, "role" = NEW.role, "status" = NEW.status::"MembershipStatus", "isAdmin" = NEW.is_admin, "accountId" = NEW.account_id, "addedByApiKeyId" = NEW.added_by_api_key_id, "createdAt" = NEW.created_at, "respondedAt" = NEW.responded_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "organizationId", "personSubjectId", "role", "status"::text, "isAdmin", "accountId", "addedByApiKeyId", "createdAt", "respondedAt" INTO NEW.id, NEW.tenant_id, NEW.organization_id, NEW.person_subject_id, NEW.role, NEW.status, NEW.is_admin, NEW.account_id, NEW.added_by_api_key_id, NEW.created_at, NEW.responded_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_outbound_event_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_outbound_event_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "OutboundEvent" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_outbound_event_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_outbound_event_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "OutboundEvent" ("id", "tenantId", "serviceId", "eventType", "payload", "targetUrl", "status", "attempts", "nextAttemptAt", "lastError", "createdAt", "deliveredAt") VALUES (NEW.id, NEW.tenant_id, NEW.service_id, NEW.event_type, NEW.payload, NEW.target_url, NEW.status::"OutboundEventStatus", NEW.attempts, NEW.next_attempt_at, NEW.last_error, NEW.created_at, NEW.delivered_at)
    RETURNING "id", "tenantId", "serviceId", "eventType", "payload", "targetUrl", "status"::text, "attempts", "nextAttemptAt", "lastError", "createdAt", "deliveredAt" INTO NEW.id, NEW.tenant_id, NEW.service_id, NEW.event_type, NEW.payload, NEW.target_url, NEW.status, NEW.attempts, NEW.next_attempt_at, NEW.last_error, NEW.created_at, NEW.delivered_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_outbound_event_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_outbound_event_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "OutboundEvent" SET "tenantId" = NEW.tenant_id, "serviceId" = NEW.service_id, "eventType" = NEW.event_type, "payload" = NEW.payload, "targetUrl" = NEW.target_url, "status" = NEW.status::"OutboundEventStatus", "attempts" = NEW.attempts, "nextAttemptAt" = NEW.next_attempt_at, "lastError" = NEW.last_error, "createdAt" = NEW.created_at, "deliveredAt" = NEW.delivered_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "serviceId", "eventType", "payload", "targetUrl", "status"::text, "attempts", "nextAttemptAt", "lastError", "createdAt", "deliveredAt" INTO NEW.id, NEW.tenant_id, NEW.service_id, NEW.event_type, NEW.payload, NEW.target_url, NEW.status, NEW.attempts, NEW.next_attempt_at, NEW.last_error, NEW.created_at, NEW.delivered_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_payment_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_payment_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "Payment" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_payment_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_payment_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "Payment" ("id", "tenantId", "paymentIntentId", "provider", "providerTransactionId", "amountMinor", "currency", "status", "methodType", "paidAt", "createdAt") VALUES (NEW.id, NEW.tenant_id, NEW.payment_intent_id, NEW.provider, NEW.provider_transaction_id, NEW.amount_minor, NEW.currency, NEW.status::"PaymentStatus", NEW.method_type, NEW.paid_at, NEW.created_at)
    RETURNING "id", "tenantId", "paymentIntentId", "provider", "providerTransactionId", "amountMinor", "currency", "status"::text, "methodType", "paidAt", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.payment_intent_id, NEW.provider, NEW.provider_transaction_id, NEW.amount_minor, NEW.currency, NEW.status, NEW.method_type, NEW.paid_at, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_payment_intent_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_payment_intent_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "PaymentIntent" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_payment_intent_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_payment_intent_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "PaymentIntent" ("id", "tenantId", "billingAccountId", "purpose", "amountMinor", "currency", "status", "provider", "providerRef", "checkoutUrl", "idempotencyKey", "metadata", "expiresAt", "createdAt", "updatedAt") VALUES (NEW.id, NEW.tenant_id, NEW.billing_account_id, NEW.purpose::"PaymentIntentPurpose", NEW.amount_minor, NEW.currency, NEW.status::"PaymentIntentStatus", NEW.provider, NEW.provider_ref, NEW.checkout_url, NEW.idempotency_key, NEW.metadata, NEW.expires_at, NEW.created_at, NEW.updated_at)
    RETURNING "id", "tenantId", "billingAccountId", "purpose"::text, "amountMinor", "currency", "status"::text, "provider", "providerRef", "checkoutUrl", "idempotencyKey", "metadata", "expiresAt", "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.billing_account_id, NEW.purpose, NEW.amount_minor, NEW.currency, NEW.status, NEW.provider, NEW.provider_ref, NEW.checkout_url, NEW.idempotency_key, NEW.metadata, NEW.expires_at, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_payment_intent_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_payment_intent_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "PaymentIntent" SET "tenantId" = NEW.tenant_id, "billingAccountId" = NEW.billing_account_id, "purpose" = NEW.purpose::"PaymentIntentPurpose", "amountMinor" = NEW.amount_minor, "currency" = NEW.currency, "status" = NEW.status::"PaymentIntentStatus", "provider" = NEW.provider, "providerRef" = NEW.provider_ref, "checkoutUrl" = NEW.checkout_url, "idempotencyKey" = NEW.idempotency_key, "metadata" = NEW.metadata, "expiresAt" = NEW.expires_at, "createdAt" = NEW.created_at, "updatedAt" = NEW.updated_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "billingAccountId", "purpose"::text, "amountMinor", "currency", "status"::text, "provider", "providerRef", "checkoutUrl", "idempotencyKey", "metadata", "expiresAt", "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.billing_account_id, NEW.purpose, NEW.amount_minor, NEW.currency, NEW.status, NEW.provider, NEW.provider_ref, NEW.checkout_url, NEW.idempotency_key, NEW.metadata, NEW.expires_at, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_payment_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_payment_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Payment" SET "tenantId" = NEW.tenant_id, "paymentIntentId" = NEW.payment_intent_id, "provider" = NEW.provider, "providerTransactionId" = NEW.provider_transaction_id, "amountMinor" = NEW.amount_minor, "currency" = NEW.currency, "status" = NEW.status::"PaymentStatus", "methodType" = NEW.method_type, "paidAt" = NEW.paid_at, "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "paymentIntentId", "provider", "providerTransactionId", "amountMinor", "currency", "status"::text, "methodType", "paidAt", "createdAt" INTO NEW.id, NEW.tenant_id, NEW.payment_intent_id, NEW.provider, NEW.provider_transaction_id, NEW.amount_minor, NEW.currency, NEW.status, NEW.method_type, NEW.paid_at, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_phone_badge_evidence_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_phone_badge_evidence_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "PhoneBadgeEvidence" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_phone_badge_evidence_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_phone_badge_evidence_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "PhoneBadgeEvidence" ("id", "phone", "tenantId", "subjectId", "caseId", "claimType", "level", "verifiedAt", "createdAt") VALUES (NEW.id, NEW.phone, NEW.tenant_id, NEW.subject_id, NEW.case_id, NEW.claim_type::"ClaimType", NEW.level::"VerificationLevel", NEW.verified_at, NEW.created_at)
    RETURNING "id", "phone", "tenantId", "subjectId", "caseId", "claimType"::text, "level"::text, "verifiedAt", "createdAt" INTO NEW.id, NEW.phone, NEW.tenant_id, NEW.subject_id, NEW.case_id, NEW.claim_type, NEW.level, NEW.verified_at, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_phone_badge_evidence_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_phone_badge_evidence_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "PhoneBadgeEvidence" SET "phone" = NEW.phone, "tenantId" = NEW.tenant_id, "subjectId" = NEW.subject_id, "caseId" = NEW.case_id, "claimType" = NEW.claim_type::"ClaimType", "level" = NEW.level::"VerificationLevel", "verifiedAt" = NEW.verified_at, "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "phone", "tenantId", "subjectId", "caseId", "claimType"::text, "level"::text, "verifiedAt", "createdAt" INTO NEW.id, NEW.phone, NEW.tenant_id, NEW.subject_id, NEW.case_id, NEW.claim_type, NEW.level, NEW.verified_at, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_plan_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_plan_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "Plan" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_plan_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_plan_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "Plan" ("id", "serviceId", "key", "version", "name", "description", "mode", "currency", "unitAmountMinor", "interval", "creditsIncluded", "overageUnitAmountMinor", "features", "status", "supersedesPlanId", "createdAt") VALUES (NEW.id, NEW.service_id, NEW.key, NEW.version, NEW.name, NEW.description, NEW.mode::"PlanMode", NEW.currency, NEW.unit_amount_minor, NEW.interval::"PlanInterval", NEW.credits_included, NEW.overage_unit_amount_minor, NEW.features, NEW.status::"PlanStatus", NEW.supersedes_plan_id, NEW.created_at)
    RETURNING "id", "serviceId", "key", "version", "name", "description", "mode"::text, "currency", "unitAmountMinor", "interval"::text, "creditsIncluded", "overageUnitAmountMinor", "features", "status"::text, "supersedesPlanId", "createdAt" INTO NEW.id, NEW.service_id, NEW.key, NEW.version, NEW.name, NEW.description, NEW.mode, NEW.currency, NEW.unit_amount_minor, NEW.interval, NEW.credits_included, NEW.overage_unit_amount_minor, NEW.features, NEW.status, NEW.supersedes_plan_id, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_plan_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_plan_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Plan" SET "serviceId" = NEW.service_id, "key" = NEW.key, "version" = NEW.version, "name" = NEW.name, "description" = NEW.description, "mode" = NEW.mode::"PlanMode", "currency" = NEW.currency, "unitAmountMinor" = NEW.unit_amount_minor, "interval" = NEW.interval::"PlanInterval", "creditsIncluded" = NEW.credits_included, "overageUnitAmountMinor" = NEW.overage_unit_amount_minor, "features" = NEW.features, "status" = NEW.status::"PlanStatus", "supersedesPlanId" = NEW.supersedes_plan_id, "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "serviceId", "key", "version", "name", "description", "mode"::text, "currency", "unitAmountMinor", "interval"::text, "creditsIncluded", "overageUnitAmountMinor", "features", "status"::text, "supersedesPlanId", "createdAt" INTO NEW.id, NEW.service_id, NEW.key, NEW.version, NEW.name, NEW.description, NEW.mode, NEW.currency, NEW.unit_amount_minor, NEW.interval, NEW.credits_included, NEW.overage_unit_amount_minor, NEW.features, NEW.status, NEW.supersedes_plan_id, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_profile_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_profile_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "Profile" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_profile_field_grant_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_profile_field_grant_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "ProfileFieldGrant" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_profile_field_grant_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_profile_field_grant_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "ProfileFieldGrant" ("id", "profileId", "field", "granteeAccountId", "granteeOrganizationId", "createdAt", "revokedAt") VALUES (NEW.id, NEW.profile_id, NEW.field::"ProfileGrantField", NEW.grantee_account_id, NEW.grantee_organization_id, NEW.created_at, NEW.revoked_at)
    RETURNING "id", "profileId", "field"::text, "granteeAccountId", "granteeOrganizationId", "createdAt", "revokedAt" INTO NEW.id, NEW.profile_id, NEW.field, NEW.grantee_account_id, NEW.grantee_organization_id, NEW.created_at, NEW.revoked_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_profile_field_grant_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_profile_field_grant_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "ProfileFieldGrant" SET "profileId" = NEW.profile_id, "field" = NEW.field::"ProfileGrantField", "granteeAccountId" = NEW.grantee_account_id, "granteeOrganizationId" = NEW.grantee_organization_id, "createdAt" = NEW.created_at, "revokedAt" = NEW.revoked_at WHERE "id" = OLD.id
    RETURNING "id", "profileId", "field"::text, "granteeAccountId", "granteeOrganizationId", "createdAt", "revokedAt" INTO NEW.id, NEW.profile_id, NEW.field, NEW.grantee_account_id, NEW.grantee_organization_id, NEW.created_at, NEW.revoked_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_profile_image_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_profile_image_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "ProfileImage" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_profile_image_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_profile_image_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "ProfileImage" ("id", "profileId", "kind", "storageKey", "contentType", "order", "createdAt") VALUES (NEW.id, NEW.profile_id, NEW.kind::"ProfileImageKind", NEW.storage_key, NEW.content_type, NEW.order, NEW.created_at)
    RETURNING "id", "profileId", "kind"::text, "storageKey", "contentType", "order", "createdAt" INTO NEW.id, NEW.profile_id, NEW.kind, NEW.storage_key, NEW.content_type, NEW.order, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_profile_image_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_profile_image_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "ProfileImage" SET "profileId" = NEW.profile_id, "kind" = NEW.kind::"ProfileImageKind", "storageKey" = NEW.storage_key, "contentType" = NEW.content_type, "order" = NEW.order, "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "profileId", "kind"::text, "storageKey", "contentType", "order", "createdAt" INTO NEW.id, NEW.profile_id, NEW.kind, NEW.storage_key, NEW.content_type, NEW.order, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_profile_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_profile_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "Profile" ("id", "accountId", "organizationId", "slug", "displayName", "headline", "category", "bio", "photoKey", "photoContentType", "phone", "whatsapp", "publicEmail", "addressLine1", "addressLine2", "city", "region", "countryCode", "latitude", "longitude", "timezone", "showPhone", "showWhatsapp", "showEmail", "showAddress", "showBadges", "showBooking", "showOffers", "showHours", "showRealName", "isPublished", "usernameSetAt", "usernameSourceName", "createdAt", "updatedAt") VALUES (NEW.id, NEW.account_id, NEW.organization_id, NEW.slug, NEW.display_name, NEW.headline, NEW.category::"ProfileCategory", NEW.bio, NEW.photo_key, NEW.photo_content_type, NEW.phone, NEW.whatsapp, NEW.public_email, NEW.address_line1, NEW.address_line2, NEW.city, NEW.region, NEW.country_code, NEW.latitude, NEW.longitude, NEW.timezone, NEW.show_phone, NEW.show_whatsapp, NEW.show_email, NEW.show_address, NEW.show_badges, NEW.show_booking, NEW.show_offers, NEW.show_hours, NEW.show_real_name, NEW.is_published, NEW.username_set_at, NEW.username_source_name, NEW.created_at, NEW.updated_at)
    RETURNING "id", "accountId", "organizationId", "slug", "displayName", "headline", "category"::text, "bio", "photoKey", "photoContentType", "phone", "whatsapp", "publicEmail", "addressLine1", "addressLine2", "city", "region", "countryCode", "latitude", "longitude", "timezone", "showPhone", "showWhatsapp", "showEmail", "showAddress", "showBadges", "showBooking", "showOffers", "showHours", "showRealName", "isPublished", "usernameSetAt", "usernameSourceName", "createdAt", "updatedAt" INTO NEW.id, NEW.account_id, NEW.organization_id, NEW.slug, NEW.display_name, NEW.headline, NEW.category, NEW.bio, NEW.photo_key, NEW.photo_content_type, NEW.phone, NEW.whatsapp, NEW.public_email, NEW.address_line1, NEW.address_line2, NEW.city, NEW.region, NEW.country_code, NEW.latitude, NEW.longitude, NEW.timezone, NEW.show_phone, NEW.show_whatsapp, NEW.show_email, NEW.show_address, NEW.show_badges, NEW.show_booking, NEW.show_offers, NEW.show_hours, NEW.show_real_name, NEW.is_published, NEW.username_set_at, NEW.username_source_name, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_profile_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_profile_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Profile" SET "accountId" = NEW.account_id, "organizationId" = NEW.organization_id, "slug" = NEW.slug, "displayName" = NEW.display_name, "headline" = NEW.headline, "category" = NEW.category::"ProfileCategory", "bio" = NEW.bio, "photoKey" = NEW.photo_key, "photoContentType" = NEW.photo_content_type, "phone" = NEW.phone, "whatsapp" = NEW.whatsapp, "publicEmail" = NEW.public_email, "addressLine1" = NEW.address_line1, "addressLine2" = NEW.address_line2, "city" = NEW.city, "region" = NEW.region, "countryCode" = NEW.country_code, "latitude" = NEW.latitude, "longitude" = NEW.longitude, "timezone" = NEW.timezone, "showPhone" = NEW.show_phone, "showWhatsapp" = NEW.show_whatsapp, "showEmail" = NEW.show_email, "showAddress" = NEW.show_address, "showBadges" = NEW.show_badges, "showBooking" = NEW.show_booking, "showOffers" = NEW.show_offers, "showHours" = NEW.show_hours, "showRealName" = NEW.show_real_name, "isPublished" = NEW.is_published, "usernameSetAt" = NEW.username_set_at, "usernameSourceName" = NEW.username_source_name, "createdAt" = NEW.created_at, "updatedAt" = NEW.updated_at WHERE "id" = OLD.id
    RETURNING "id", "accountId", "organizationId", "slug", "displayName", "headline", "category"::text, "bio", "photoKey", "photoContentType", "phone", "whatsapp", "publicEmail", "addressLine1", "addressLine2", "city", "region", "countryCode", "latitude", "longitude", "timezone", "showPhone", "showWhatsapp", "showEmail", "showAddress", "showBadges", "showBooking", "showOffers", "showHours", "showRealName", "isPublished", "usernameSetAt", "usernameSourceName", "createdAt", "updatedAt" INTO NEW.id, NEW.account_id, NEW.organization_id, NEW.slug, NEW.display_name, NEW.headline, NEW.category, NEW.bio, NEW.photo_key, NEW.photo_content_type, NEW.phone, NEW.whatsapp, NEW.public_email, NEW.address_line1, NEW.address_line2, NEW.city, NEW.region, NEW.country_code, NEW.latitude, NEW.longitude, NEW.timezone, NEW.show_phone, NEW.show_whatsapp, NEW.show_email, NEW.show_address, NEW.show_badges, NEW.show_booking, NEW.show_offers, NEW.show_hours, NEW.show_real_name, NEW.is_published, NEW.username_set_at, NEW.username_source_name, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_refund_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_refund_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "Refund" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_refund_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_refund_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "Refund" ("id", "tenantId", "paymentId", "amountMinor", "status", "reason", "providerRef", "createdAt", "updatedAt") VALUES (NEW.id, NEW.tenant_id, NEW.payment_id, NEW.amount_minor, NEW.status::"RefundStatus", NEW.reason, NEW.provider_ref, NEW.created_at, NEW.updated_at)
    RETURNING "id", "tenantId", "paymentId", "amountMinor", "status"::text, "reason", "providerRef", "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.payment_id, NEW.amount_minor, NEW.status, NEW.reason, NEW.provider_ref, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_refund_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_refund_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Refund" SET "tenantId" = NEW.tenant_id, "paymentId" = NEW.payment_id, "amountMinor" = NEW.amount_minor, "status" = NEW.status::"RefundStatus", "reason" = NEW.reason, "providerRef" = NEW.provider_ref, "createdAt" = NEW.created_at, "updatedAt" = NEW.updated_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "paymentId", "amountMinor", "status"::text, "reason", "providerRef", "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.payment_id, NEW.amount_minor, NEW.status, NEW.reason, NEW.provider_ref, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_role_assignment_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_role_assignment_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "RoleAssignment" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_role_assignment_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_role_assignment_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "RoleAssignment" ("id", "accountId", "roleDefinitionId", "tenantId", "organizationId", "brandId", "scope", "createdAt") VALUES (NEW.id, NEW.account_id, NEW.role_definition_id, NEW.tenant_id, NEW.organization_id, NEW.brand_id, NEW.scope::"AccessScope", NEW.created_at)
    RETURNING "id", "accountId", "roleDefinitionId", "tenantId", "organizationId", "brandId", "scope"::text, "createdAt" INTO NEW.id, NEW.account_id, NEW.role_definition_id, NEW.tenant_id, NEW.organization_id, NEW.brand_id, NEW.scope, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_role_assignment_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_role_assignment_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "RoleAssignment" SET "accountId" = NEW.account_id, "roleDefinitionId" = NEW.role_definition_id, "tenantId" = NEW.tenant_id, "organizationId" = NEW.organization_id, "brandId" = NEW.brand_id, "scope" = NEW.scope::"AccessScope", "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "accountId", "roleDefinitionId", "tenantId", "organizationId", "brandId", "scope"::text, "createdAt" INTO NEW.id, NEW.account_id, NEW.role_definition_id, NEW.tenant_id, NEW.organization_id, NEW.brand_id, NEW.scope, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_settlement_record_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_settlement_record_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "SettlementRecord" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_settlement_record_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_settlement_record_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "SettlementRecord" ("id", "provider", "providerSettlementId", "amountMinor", "feeMinor", "netMinor", "currency", "settledAt", "matchedPaymentId", "matchedTenantId", "status", "createdAt") VALUES (NEW.id, NEW.provider, NEW.provider_settlement_id, NEW.amount_minor, NEW.fee_minor, NEW.net_minor, NEW.currency, NEW.settled_at, NEW.matched_payment_id, NEW.matched_tenant_id, NEW.status::"SettlementStatus", NEW.created_at)
    RETURNING "id", "provider", "providerSettlementId", "amountMinor", "feeMinor", "netMinor", "currency", "settledAt", "matchedPaymentId", "matchedTenantId", "status"::text, "createdAt" INTO NEW.id, NEW.provider, NEW.provider_settlement_id, NEW.amount_minor, NEW.fee_minor, NEW.net_minor, NEW.currency, NEW.settled_at, NEW.matched_payment_id, NEW.matched_tenant_id, NEW.status, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_settlement_record_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_settlement_record_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "SettlementRecord" SET "provider" = NEW.provider, "providerSettlementId" = NEW.provider_settlement_id, "amountMinor" = NEW.amount_minor, "feeMinor" = NEW.fee_minor, "netMinor" = NEW.net_minor, "currency" = NEW.currency, "settledAt" = NEW.settled_at, "matchedPaymentId" = NEW.matched_payment_id, "matchedTenantId" = NEW.matched_tenant_id, "status" = NEW.status::"SettlementStatus", "createdAt" = NEW.created_at WHERE "id" = OLD.id
    RETURNING "id", "provider", "providerSettlementId", "amountMinor", "feeMinor", "netMinor", "currency", "settledAt", "matchedPaymentId", "matchedTenantId", "status"::text, "createdAt" INTO NEW.id, NEW.provider, NEW.provider_settlement_id, NEW.amount_minor, NEW.fee_minor, NEW.net_minor, NEW.currency, NEW.settled_at, NEW.matched_payment_id, NEW.matched_tenant_id, NEW.status, NEW.created_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_social_link_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_social_link_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "SocialLink" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_social_link_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_social_link_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "SocialLink" ("id", "profileId", "platform", "url", "order") VALUES (NEW.id, NEW.profile_id, NEW.platform::"SocialPlatform", NEW.url, NEW.order)
    RETURNING "id", "profileId", "platform"::text, "url", "order" INTO NEW.id, NEW.profile_id, NEW.platform, NEW.url, NEW.order;
  RETURN NEW;
END;
$$;


--
-- Name: tg_social_link_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_social_link_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "SocialLink" SET "profileId" = NEW.profile_id, "platform" = NEW.platform::"SocialPlatform", "url" = NEW.url, "order" = NEW.order WHERE "id" = OLD.id
    RETURNING "id", "profileId", "platform"::text, "url", "order" INTO NEW.id, NEW.profile_id, NEW.platform, NEW.url, NEW.order;
  RETURN NEW;
END;
$$;


--
-- Name: tg_subject_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_subject_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "Subject" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_subject_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_subject_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "Subject" ("id", "tenantId", "externalRef", "type", "givenName", "familyName", "email", "phone", "dateOfBirth", "nationalIdNumber", "addressLine1", "addressLine2", "city", "region", "countryCode", "latitude", "longitude", "accountId", "createdAt", "updatedAt") VALUES (NEW.id, NEW.tenant_id, NEW.external_ref, NEW.type::"SubjectType", NEW.given_name, NEW.family_name, NEW.email, NEW.phone, NEW.date_of_birth, NEW.national_id_number, NEW.address_line1, NEW.address_line2, NEW.city, NEW.region, NEW.country_code, NEW.latitude, NEW.longitude, NEW.account_id, NEW.created_at, NEW.updated_at)
    RETURNING "id", "tenantId", "externalRef", "type"::text, "givenName", "familyName", "email", "phone", "dateOfBirth", "nationalIdNumber", "addressLine1", "addressLine2", "city", "region", "countryCode", "latitude", "longitude", "accountId", "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.external_ref, NEW.type, NEW.given_name, NEW.family_name, NEW.email, NEW.phone, NEW.date_of_birth, NEW.national_id_number, NEW.address_line1, NEW.address_line2, NEW.city, NEW.region, NEW.country_code, NEW.latitude, NEW.longitude, NEW.account_id, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_subject_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_subject_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Subject" SET "tenantId" = NEW.tenant_id, "externalRef" = NEW.external_ref, "type" = NEW.type::"SubjectType", "givenName" = NEW.given_name, "familyName" = NEW.family_name, "email" = NEW.email, "phone" = NEW.phone, "dateOfBirth" = NEW.date_of_birth, "nationalIdNumber" = NEW.national_id_number, "addressLine1" = NEW.address_line1, "addressLine2" = NEW.address_line2, "city" = NEW.city, "region" = NEW.region, "countryCode" = NEW.country_code, "latitude" = NEW.latitude, "longitude" = NEW.longitude, "accountId" = NEW.account_id, "createdAt" = NEW.created_at, "updatedAt" = NEW.updated_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "externalRef", "type"::text, "givenName", "familyName", "email", "phone", "dateOfBirth", "nationalIdNumber", "addressLine1", "addressLine2", "city", "region", "countryCode", "latitude", "longitude", "accountId", "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.external_ref, NEW.type, NEW.given_name, NEW.family_name, NEW.email, NEW.phone, NEW.date_of_birth, NEW.national_id_number, NEW.address_line1, NEW.address_line2, NEW.city, NEW.region, NEW.country_code, NEW.latitude, NEW.longitude, NEW.account_id, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_subscription_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_subscription_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "Subscription" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_subscription_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_subscription_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "Subscription" ("id", "tenantId", "billingAccountId", "planId", "status", "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd", "startedAt", "canceledAt", "providerTokenId", "createdAt", "updatedAt") VALUES (NEW.id, NEW.tenant_id, NEW.billing_account_id, NEW.plan_id, NEW.status::"SubscriptionStatus", NEW.current_period_start, NEW.current_period_end, NEW.cancel_at_period_end, NEW.started_at, NEW.canceled_at, NEW.provider_token_id, NEW.created_at, NEW.updated_at)
    RETURNING "id", "tenantId", "billingAccountId", "planId", "status"::text, "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd", "startedAt", "canceledAt", "providerTokenId", "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.billing_account_id, NEW.plan_id, NEW.status, NEW.current_period_start, NEW.current_period_end, NEW.cancel_at_period_end, NEW.started_at, NEW.canceled_at, NEW.provider_token_id, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_subscription_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_subscription_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Subscription" SET "tenantId" = NEW.tenant_id, "billingAccountId" = NEW.billing_account_id, "planId" = NEW.plan_id, "status" = NEW.status::"SubscriptionStatus", "currentPeriodStart" = NEW.current_period_start, "currentPeriodEnd" = NEW.current_period_end, "cancelAtPeriodEnd" = NEW.cancel_at_period_end, "startedAt" = NEW.started_at, "canceledAt" = NEW.canceled_at, "providerTokenId" = NEW.provider_token_id, "createdAt" = NEW.created_at, "updatedAt" = NEW.updated_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "billingAccountId", "planId", "status"::text, "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd", "startedAt", "canceledAt", "providerTokenId", "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.billing_account_id, NEW.plan_id, NEW.status, NEW.current_period_start, NEW.current_period_end, NEW.cancel_at_period_end, NEW.started_at, NEW.canceled_at, NEW.provider_token_id, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_verification_case_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_verification_case_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "VerificationCase" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_verification_case_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_verification_case_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "VerificationCase" ("id", "tenantId", "subjectId", "policyId", "status", "temporalWorkflowId", "decision", "reviewerId", "claimType", "level", "createdAt", "updatedAt", "resolvedAt") VALUES (NEW.id, NEW.tenant_id, NEW.subject_id, NEW.policy_id, NEW.status::"CaseStatus", NEW.temporal_workflow_id, NEW.decision, NEW.reviewer_id, NEW.claim_type::"ClaimType", NEW.level::"VerificationLevel", NEW.created_at, NEW.updated_at, NEW.resolved_at)
    RETURNING "id", "tenantId", "subjectId", "policyId", "status"::text, "temporalWorkflowId", "decision", "reviewerId", "claimType"::text, "level"::text, "createdAt", "updatedAt", "resolvedAt" INTO NEW.id, NEW.tenant_id, NEW.subject_id, NEW.policy_id, NEW.status, NEW.temporal_workflow_id, NEW.decision, NEW.reviewer_id, NEW.claim_type, NEW.level, NEW.created_at, NEW.updated_at, NEW.resolved_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_verification_case_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_verification_case_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "VerificationCase" SET "tenantId" = NEW.tenant_id, "subjectId" = NEW.subject_id, "policyId" = NEW.policy_id, "status" = NEW.status::"CaseStatus", "temporalWorkflowId" = NEW.temporal_workflow_id, "decision" = NEW.decision, "reviewerId" = NEW.reviewer_id, "claimType" = NEW.claim_type::"ClaimType", "level" = NEW.level::"VerificationLevel", "createdAt" = NEW.created_at, "updatedAt" = NEW.updated_at, "resolvedAt" = NEW.resolved_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "subjectId", "policyId", "status"::text, "temporalWorkflowId", "decision", "reviewerId", "claimType"::text, "level"::text, "createdAt", "updatedAt", "resolvedAt" INTO NEW.id, NEW.tenant_id, NEW.subject_id, NEW.policy_id, NEW.status, NEW.temporal_workflow_id, NEW.decision, NEW.reviewer_id, NEW.claim_type, NEW.level, NEW.created_at, NEW.updated_at, NEW.resolved_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_verification_method_attempt_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_verification_method_attempt_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "VerificationMethodAttempt" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_verification_method_attempt_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_verification_method_attempt_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "VerificationMethodAttempt" ("id", "tenantId", "caseId", "method", "status", "providerKey", "resultMeta", "raw", "score", "startedAt", "completedAt") VALUES (NEW.id, NEW.tenant_id, NEW.case_id, NEW.method, NEW.status::"AttemptStatus", NEW.provider_key, NEW.result_meta, NEW.raw, NEW.score, NEW.started_at, NEW.completed_at)
    RETURNING "id", "tenantId", "caseId", "method", "status"::text, "providerKey", "resultMeta", "raw", "score", "startedAt", "completedAt" INTO NEW.id, NEW.tenant_id, NEW.case_id, NEW.method, NEW.status, NEW.provider_key, NEW.result_meta, NEW.raw, NEW.score, NEW.started_at, NEW.completed_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_verification_method_attempt_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_verification_method_attempt_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "VerificationMethodAttempt" SET "tenantId" = NEW.tenant_id, "caseId" = NEW.case_id, "method" = NEW.method, "status" = NEW.status::"AttemptStatus", "providerKey" = NEW.provider_key, "resultMeta" = NEW.result_meta, "raw" = NEW.raw, "score" = NEW.score, "startedAt" = NEW.started_at, "completedAt" = NEW.completed_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "caseId", "method", "status"::text, "providerKey", "resultMeta", "raw", "score", "startedAt", "completedAt" INTO NEW.id, NEW.tenant_id, NEW.case_id, NEW.method, NEW.status, NEW.provider_key, NEW.result_meta, NEW.raw, NEW.score, NEW.started_at, NEW.completed_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_verification_policy_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_verification_policy_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "VerificationPolicy" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_verification_policy_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_verification_policy_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "VerificationPolicy" ("id", "tenantId", "name", "methods", "requireAll", "claimType", "level", "createdAt", "updatedAt") VALUES (NEW.id, NEW.tenant_id, NEW.name, NEW.methods, NEW.require_all, NEW.claim_type::"ClaimType", NEW.level::"VerificationLevel", NEW.created_at, NEW.updated_at)
    RETURNING "id", "tenantId", "name", "methods", "requireAll", "claimType"::text, "level"::text, "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.name, NEW.methods, NEW.require_all, NEW.claim_type, NEW.level, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_verification_policy_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_verification_policy_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "VerificationPolicy" SET "tenantId" = NEW.tenant_id, "name" = NEW.name, "methods" = NEW.methods, "requireAll" = NEW.require_all, "claimType" = NEW.claim_type::"ClaimType", "level" = NEW.level::"VerificationLevel", "createdAt" = NEW.created_at, "updatedAt" = NEW.updated_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "name", "methods", "requireAll", "claimType"::text, "level"::text, "createdAt", "updatedAt" INTO NEW.id, NEW.tenant_id, NEW.name, NEW.methods, NEW.require_all, NEW.claim_type, NEW.level, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_verified_attribute_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_verified_attribute_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "VerifiedAttribute" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_verified_attribute_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_verified_attribute_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "VerifiedAttribute" ("id", "tenantId", "subjectId", "attribute", "level", "method", "caseId", "verifiedAt") VALUES (NEW.id, NEW.tenant_id, NEW.subject_id, NEW.attribute::"AttributeType", NEW.level::"VerificationLevel", NEW.method, NEW.case_id, NEW.verified_at)
    RETURNING "id", "tenantId", "subjectId", "attribute"::text, "level"::text, "method", "caseId", "verifiedAt" INTO NEW.id, NEW.tenant_id, NEW.subject_id, NEW.attribute, NEW.level, NEW.method, NEW.case_id, NEW.verified_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_verified_attribute_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_verified_attribute_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "VerifiedAttribute" SET "tenantId" = NEW.tenant_id, "subjectId" = NEW.subject_id, "attribute" = NEW.attribute::"AttributeType", "level" = NEW.level::"VerificationLevel", "method" = NEW.method, "caseId" = NEW.case_id, "verifiedAt" = NEW.verified_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "subjectId", "attribute"::text, "level"::text, "method", "caseId", "verifiedAt" INTO NEW.id, NEW.tenant_id, NEW.subject_id, NEW.attribute, NEW.level, NEW.method, NEW.case_id, NEW.verified_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_webhook_event_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_webhook_event_del() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "WebhookEvent" WHERE "id" = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: tg_webhook_event_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_webhook_event_ins() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "WebhookEvent" ("id", "tenantId", "provider", "providerEventId", "type", "payload", "signatureValid", "status", "error", "receivedAt", "processedAt") VALUES (NEW.id, NEW.tenant_id, NEW.provider, NEW.provider_event_id, NEW.type, NEW.payload, NEW.signature_valid, NEW.status::"WebhookEventStatus", NEW.error, NEW.received_at, NEW.processed_at)
    RETURNING "id", "tenantId", "provider", "providerEventId", "type", "payload", "signatureValid", "status"::text, "error", "receivedAt", "processedAt" INTO NEW.id, NEW.tenant_id, NEW.provider, NEW.provider_event_id, NEW.type, NEW.payload, NEW.signature_valid, NEW.status, NEW.error, NEW.received_at, NEW.processed_at;
  RETURN NEW;
END;
$$;


--
-- Name: tg_webhook_event_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_webhook_event_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "WebhookEvent" SET "tenantId" = NEW.tenant_id, "provider" = NEW.provider, "providerEventId" = NEW.provider_event_id, "type" = NEW.type, "payload" = NEW.payload, "signatureValid" = NEW.signature_valid, "status" = NEW.status::"WebhookEventStatus", "error" = NEW.error, "receivedAt" = NEW.received_at, "processedAt" = NEW.processed_at WHERE "id" = OLD.id
    RETURNING "id", "tenantId", "provider", "providerEventId", "type", "payload", "signatureValid", "status"::text, "error", "receivedAt", "processedAt" INTO NEW.id, NEW.tenant_id, NEW.provider, NEW.provider_event_id, NEW.type, NEW.payload, NEW.signature_valid, NEW.status, NEW.error, NEW.received_at, NEW.processed_at;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AccessGrant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AccessGrant" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "tenantId" text NOT NULL,
    "organizationId" text,
    "brandId" text,
    "accessType" public."AccessType" NOT NULL,
    "partnershipPercentage" double precision,
    "grantedBy" text NOT NULL,
    status public."AccessGrantStatus" DEFAULT 'ACTIVE'::public."AccessGrantStatus" NOT NULL,
    "grantedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    phone text NOT NULL,
    email text,
    "phoneVerifiedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "emailVerifiedAt" timestamp with time zone
);


--
-- Name: AccountEmailOtpCode; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AccountEmailOtpCode" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    email text NOT NULL,
    "codeHash" text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "consumedAt" timestamp with time zone,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AccountOtpCode; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AccountOtpCode" (
    id text NOT NULL,
    phone text NOT NULL,
    "codeHash" text NOT NULL,
    "consumedAt" timestamp with time zone,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    attempts integer DEFAULT 0 NOT NULL
);


--
-- Name: AccountSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AccountSession" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Appointment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Appointment" (
    id text NOT NULL,
    "profileId" text NOT NULL,
    "serviceId" text NOT NULL,
    status public."AppointmentStatus" DEFAULT 'PENDING'::public."AppointmentStatus" NOT NULL,
    "startsAt" timestamp with time zone NOT NULL,
    "endsAt" timestamp with time zone NOT NULL,
    "visitorName" text NOT NULL,
    "visitorPhone" text,
    "visitorEmail" text,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AuditLogEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLogEntry" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "actorType" public."AuditActorType" NOT NULL,
    "actorId" text,
    action text NOT NULL,
    "subjectId" text,
    "caseId" text,
    "ipAddress" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "entityId" text,
    "entityType" text,
    metadata jsonb
);

ALTER TABLE ONLY public."AuditLogEntry" FORCE ROW LEVEL SECURITY;


--
-- Name: AvailabilityRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AvailabilityRule" (
    id text NOT NULL,
    "profileId" text NOT NULL,
    day public."Weekday" NOT NULL,
    "startMinute" integer NOT NULL,
    "endMinute" integer NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


--
-- Name: BillingAccount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BillingAccount" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    currency text DEFAULT 'PKR'::text NOT NULL,
    status public."BillingAccountStatus" DEFAULT 'ACTIVE'::public."BillingAccountStatus" NOT NULL,
    "creditBalanceMinor" bigint DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."BillingAccount" FORCE ROW LEVEL SECURITY;


--
-- Name: BillingService; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BillingService" (
    id text NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    "ownerRepo" text NOT NULL,
    status public."BillingServiceStatus" DEFAULT 'ACTIVE'::public."BillingServiceStatus" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."BillingService" FORCE ROW LEVEL SECURITY;


--
-- Name: BillingServiceCredential; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BillingServiceCredential" (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    label text NOT NULL,
    "keyPrefix" text NOT NULL,
    "keyHash" text NOT NULL,
    scopes text[] DEFAULT ARRAY[]::text[],
    "lastUsedAt" timestamp with time zone,
    "revokedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."BillingServiceCredential" FORCE ROW LEVEL SECURITY;


--
-- Name: Brand; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Brand" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    bio text,
    website text,
    email text,
    phone text,
    colors jsonb,
    "socialLinks" jsonb,
    products jsonb,
    services jsonb,
    prices jsonb,
    policies jsonb,
    rules jsonb,
    "toneGuidelines" jsonb,
    keywords jsonb,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    address text,
    "logoKey" text,
    "primaryColor" text,
    "secondaryColor" text
);


--
-- Name: BusinessHour; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessHour" (
    id text NOT NULL,
    "profileId" text NOT NULL,
    day public."Weekday" NOT NULL,
    "openMinute" integer,
    "closeMinute" integer,
    "isClosed" boolean DEFAULT false NOT NULL
);


--
-- Name: CheckoutSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CheckoutSession" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "paymentIntentId" text NOT NULL,
    "tokenHash" text NOT NULL,
    status public."CheckoutSessionStatus" DEFAULT 'PENDING'::public."CheckoutSessionStatus" NOT NULL,
    "returnUrl" text,
    "expiresAt" timestamp with time zone NOT NULL,
    "consumedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."CheckoutSession" FORCE ROW LEVEL SECURITY;


--
-- Name: ContactMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContactMessage" (
    id text NOT NULL,
    "profileId" text NOT NULL,
    "senderName" text NOT NULL,
    "senderPhone" text,
    "senderEmail" text,
    message text NOT NULL,
    "readAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CreditLedgerEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CreditLedgerEntry" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "billingAccountId" text NOT NULL,
    "deltaMinor" bigint NOT NULL,
    reason public."CreditEntryReason" NOT NULL,
    "refType" text NOT NULL,
    "refId" text NOT NULL,
    "balanceAfterMinor" bigint NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."CreditLedgerEntry" FORCE ROW LEVEL SECURITY;


--
-- Name: CustomLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomLink" (
    id text NOT NULL,
    "profileId" text NOT NULL,
    label text NOT NULL,
    url text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Department" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "defaultPermissions" jsonb,
    icon text,
    color text,
    "inheritedFromTenant" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DepartmentAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DepartmentAssignment" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "departmentId" text NOT NULL,
    "tenantId" text NOT NULL,
    "organizationId" text,
    "brandId" text,
    scope public."AccessScope" DEFAULT 'TENANT'::public."AccessScope" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DocumentAsset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DocumentAsset" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "methodAttemptId" text NOT NULL,
    "storageKey" text NOT NULL,
    "contentType" text NOT NULL,
    "sizeBytes" integer,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public."DocumentAsset" FORCE ROW LEVEL SECURITY;


--
-- Name: Invitation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invitation" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    email text,
    username text,
    "invitedBy" text NOT NULL,
    "organizationId" text,
    "brandId" text,
    scope public."AccessScope" NOT NULL,
    "roleDefinitionId" text,
    "departmentId" text,
    status public."InvitationStatus" DEFAULT 'PENDING'::public."InvitationStatus" NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "acceptedAt" timestamp with time zone,
    "acceptedBy" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invoice" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "billingAccountId" text NOT NULL,
    number text NOT NULL,
    status public."InvoiceStatus" DEFAULT 'DRAFT'::public."InvoiceStatus" NOT NULL,
    currency text NOT NULL,
    "subtotalMinor" bigint NOT NULL,
    "taxMinor" bigint DEFAULT 0 NOT NULL,
    "totalMinor" bigint NOT NULL,
    "amountPaidMinor" bigint DEFAULT 0 NOT NULL,
    "periodStart" timestamp with time zone,
    "periodEnd" timestamp with time zone,
    "dueAt" timestamp with time zone,
    "issuedAt" timestamp with time zone,
    "paidAt" timestamp with time zone,
    "voidedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."Invoice" FORCE ROW LEVEL SECURITY;


--
-- Name: InvoiceLine; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InvoiceLine" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "invoiceId" text NOT NULL,
    "serviceId" text NOT NULL,
    "subscriptionId" text,
    description text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    "unitAmountMinor" bigint NOT NULL,
    "amountMinor" bigint NOT NULL,
    "taxMinor" bigint DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."InvoiceLine" FORCE ROW LEVEL SECURITY;


--
-- Name: LedgerAccount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LedgerAccount" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "serviceId" text,
    kind public."LedgerAccountKind" NOT NULL,
    currency text NOT NULL,
    "scopeKey" text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."LedgerAccount" FORCE ROW LEVEL SECURITY;


--
-- Name: LedgerEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LedgerEntry" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "transactionId" text NOT NULL,
    "accountId" text NOT NULL,
    direction public."LedgerDirection" NOT NULL,
    "amountMinor" bigint NOT NULL
);

ALTER TABLE ONLY public."LedgerEntry" FORCE ROW LEVEL SECURITY;


--
-- Name: LedgerTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LedgerTransaction" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    type public."LedgerTransactionType" NOT NULL,
    "refType" text NOT NULL,
    "refId" text NOT NULL,
    currency text NOT NULL,
    "occurredAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."LedgerTransaction" FORCE ROW LEVEL SECURITY;


--
-- Name: OAuthClient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OAuthClient" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    "clientId" text NOT NULL,
    "clientSecretHash" text NOT NULL,
    "redirectUris" text[],
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."OAuthClient" FORCE ROW LEVEL SECURITY;


--
-- Name: OAuthLoginRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OAuthLoginRequest" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "clientId" text NOT NULL,
    "redirectUri" text NOT NULL,
    state text,
    status public."LoginRequestStatus" DEFAULT 'PENDING'::public."LoginRequestStatus" NOT NULL,
    "accountId" text,
    "pollTokenHash" text NOT NULL,
    "codeHash" text,
    "codeConsumedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL
);

ALTER TABLE ONLY public."OAuthLoginRequest" FORCE ROW LEVEL SECURITY;


--
-- Name: Offer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Offer" (
    id text NOT NULL,
    "profileId" text NOT NULL,
    title text NOT NULL,
    description text,
    "imageKey" text,
    "validUntil" timestamp with time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Organization" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "subjectId" text NOT NULL,
    "legalName" text NOT NULL,
    "registrationNumber" text,
    "countryCode" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."Organization" FORCE ROW LEVEL SECURITY;


--
-- Name: OrganizationBeneficialOwner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrganizationBeneficialOwner" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "organizationId" text NOT NULL,
    "personSubjectId" text NOT NULL,
    role text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public."OrganizationBeneficialOwner" FORCE ROW LEVEL SECURITY;


--
-- Name: OrganizationMembership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrganizationMembership" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "organizationId" text NOT NULL,
    "personSubjectId" text NOT NULL,
    role text,
    "addedByApiKeyId" text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    status public."MembershipStatus" DEFAULT 'ACTIVE'::public."MembershipStatus" NOT NULL,
    "isAdmin" boolean DEFAULT false NOT NULL,
    "accountId" text,
    "respondedAt" timestamp with time zone
);

ALTER TABLE ONLY public."OrganizationMembership" FORCE ROW LEVEL SECURITY;


--
-- Name: OutboundEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OutboundEvent" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "serviceId" text,
    "eventType" text NOT NULL,
    payload jsonb NOT NULL,
    "targetUrl" text NOT NULL,
    status public."OutboundEventStatus" DEFAULT 'PENDING'::public."OutboundEventStatus" NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "nextAttemptAt" timestamp with time zone,
    "lastError" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deliveredAt" timestamp with time zone
);

ALTER TABLE ONLY public."OutboundEvent" FORCE ROW LEVEL SECURITY;


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "paymentIntentId" text NOT NULL,
    provider text NOT NULL,
    "providerTransactionId" text NOT NULL,
    "amountMinor" bigint NOT NULL,
    currency text NOT NULL,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    "methodType" text,
    "paidAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."Payment" FORCE ROW LEVEL SECURITY;


--
-- Name: PaymentIntent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentIntent" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "billingAccountId" text NOT NULL,
    purpose public."PaymentIntentPurpose" NOT NULL,
    "amountMinor" bigint NOT NULL,
    currency text NOT NULL,
    status public."PaymentIntentStatus" DEFAULT 'REQUIRES_CHECKOUT'::public."PaymentIntentStatus" NOT NULL,
    provider text NOT NULL,
    "providerRef" text,
    "checkoutUrl" text,
    "idempotencyKey" text NOT NULL,
    metadata jsonb,
    "expiresAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."PaymentIntent" FORCE ROW LEVEL SECURITY;


--
-- Name: PermissionCatalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PermissionCatalog" (
    id text NOT NULL,
    "groupName" text NOT NULL,
    "serviceName" text NOT NULL,
    "permissionKey" text NOT NULL,
    label text NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PhoneBadgeEvidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PhoneBadgeEvidence" (
    id text NOT NULL,
    phone text NOT NULL,
    "tenantId" text NOT NULL,
    "subjectId" text NOT NULL,
    "caseId" text,
    "claimType" public."ClaimType" NOT NULL,
    level public."VerificationLevel" NOT NULL,
    "verifiedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PhoneNameEvidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PhoneNameEvidence" (
    id text NOT NULL,
    phone text NOT NULL,
    "tenantId" text NOT NULL,
    "subjectId" text NOT NULL,
    "caseId" text NOT NULL,
    "givenName" text NOT NULL,
    "familyName" text NOT NULL,
    "verifiedAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    method text NOT NULL
);


--
-- Name: Plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Plan" (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    key text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    name text NOT NULL,
    description text,
    mode public."PlanMode" NOT NULL,
    currency text DEFAULT 'PKR'::text NOT NULL,
    "unitAmountMinor" bigint NOT NULL,
    "interval" public."PlanInterval",
    "creditsIncluded" integer DEFAULT 0 NOT NULL,
    "overageUnitAmountMinor" bigint,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    status public."PlanStatus" DEFAULT 'ACTIVE'::public."PlanStatus" NOT NULL,
    "supersedesPlanId" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."Plan" FORCE ROW LEVEL SECURITY;


--
-- Name: Profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Profile" (
    id text NOT NULL,
    "accountId" text,
    slug text NOT NULL,
    "displayName" text NOT NULL,
    headline text,
    category public."ProfileCategory" DEFAULT 'OTHER'::public."ProfileCategory" NOT NULL,
    bio text,
    "photoKey" text,
    phone text,
    whatsapp text,
    "publicEmail" text,
    "addressLine1" text,
    "addressLine2" text,
    city text,
    region text,
    "countryCode" text,
    latitude double precision,
    longitude double precision,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    "showPhone" boolean DEFAULT false NOT NULL,
    "showWhatsapp" boolean DEFAULT false NOT NULL,
    "showEmail" boolean DEFAULT false NOT NULL,
    "showAddress" boolean DEFAULT false NOT NULL,
    "showBadges" boolean DEFAULT true NOT NULL,
    "showBooking" boolean DEFAULT true NOT NULL,
    "showOffers" boolean DEFAULT true NOT NULL,
    "showHours" boolean DEFAULT true NOT NULL,
    "isPublished" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "photoContentType" text,
    "organizationId" text,
    "usernameSetAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "usernameSourceName" text DEFAULT ''::text NOT NULL,
    "showRealName" boolean DEFAULT false NOT NULL,
    CONSTRAINT "Profile_owner_xor_check" CHECK ((("accountId" IS NOT NULL) <> ("organizationId" IS NOT NULL)))
);


--
-- Name: ProfileFieldGrant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProfileFieldGrant" (
    id text NOT NULL,
    "profileId" text NOT NULL,
    field public."ProfileGrantField" NOT NULL,
    "granteeAccountId" text,
    "granteeOrganizationId" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "revokedAt" timestamp with time zone,
    CONSTRAINT "ProfileFieldGrant_grantee_check" CHECK ((("granteeAccountId" IS NOT NULL) <> ("granteeOrganizationId" IS NOT NULL)))
);


--
-- Name: ProfileImage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProfileImage" (
    id text NOT NULL,
    "profileId" text NOT NULL,
    kind public."ProfileImageKind" NOT NULL,
    "storageKey" text NOT NULL,
    "contentType" text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Refund; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Refund" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "paymentId" text NOT NULL,
    "amountMinor" bigint NOT NULL,
    status public."RefundStatus" DEFAULT 'PENDING'::public."RefundStatus" NOT NULL,
    reason text,
    "providerRef" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."Refund" FORCE ROW LEVEL SECURITY;


--
-- Name: RoleAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RoleAssignment" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "roleDefinitionId" text NOT NULL,
    "tenantId" text NOT NULL,
    "organizationId" text,
    "brandId" text,
    scope public."AccessScope" DEFAULT 'TENANT'::public."AccessScope" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RoleDefinition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RoleDefinition" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    permissions jsonb NOT NULL,
    description text,
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Service; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Service" (
    id text NOT NULL,
    "profileId" text NOT NULL,
    name text NOT NULL,
    description text,
    "durationMinutes" integer NOT NULL,
    price double precision,
    currency text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SettlementRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SettlementRecord" (
    id text NOT NULL,
    provider text NOT NULL,
    "providerSettlementId" text NOT NULL,
    "amountMinor" bigint NOT NULL,
    "feeMinor" bigint NOT NULL,
    "netMinor" bigint NOT NULL,
    currency text NOT NULL,
    "settledAt" timestamp with time zone NOT NULL,
    "matchedPaymentId" text,
    "matchedTenantId" text,
    status public."SettlementStatus" DEFAULT 'DISCREPANCY'::public."SettlementStatus" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."SettlementRecord" FORCE ROW LEVEL SECURITY;


--
-- Name: SocialLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SocialLink" (
    id text NOT NULL,
    "profileId" text NOT NULL,
    platform public."SocialPlatform" NOT NULL,
    url text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL
);


--
-- Name: Subject; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Subject" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "externalRef" text,
    type public."SubjectType" NOT NULL,
    "givenName" text,
    "familyName" text,
    email text,
    phone text,
    "dateOfBirth" timestamp with time zone,
    "nationalIdNumber" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "addressLine1" text,
    "addressLine2" text,
    city text,
    region text,
    "countryCode" text,
    latitude double precision,
    longitude double precision,
    "accountId" text
);

ALTER TABLE ONLY public."Subject" FORCE ROW LEVEL SECURITY;


--
-- Name: Subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Subscription" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "billingAccountId" text NOT NULL,
    "planId" text NOT NULL,
    status public."SubscriptionStatus" DEFAULT 'INCOMPLETE'::public."SubscriptionStatus" NOT NULL,
    "currentPeriodStart" timestamp with time zone,
    "currentPeriodEnd" timestamp with time zone,
    "cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
    "startedAt" timestamp with time zone,
    "canceledAt" timestamp with time zone,
    "providerTokenId" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."Subscription" FORCE ROW LEVEL SECURITY;


--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tenant" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "dataResidencyRegion" text DEFAULT 'global'::text NOT NULL,
    "webhookUrl" text,
    "webhookSecretPlaintext" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "billingWebhookSecretPlaintext" text,
    "billingWebhookUrl" text
);

ALTER TABLE ONLY public."Tenant" FORCE ROW LEVEL SECURITY;


--
-- Name: TenantApiKey; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TenantApiKey" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "keyPrefix" text NOT NULL,
    "keyHash" text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    "rateLimitPerMinute" integer DEFAULT 60 NOT NULL,
    "revokedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public."TenantApiKey" FORCE ROW LEVEL SECURITY;


--
-- Name: TenantStaffMembership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TenantStaffMembership" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "accountId" text NOT NULL,
    role text DEFAULT 'STAFF'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public."TenantStaffMembership" FORCE ROW LEVEL SECURITY;


--
-- Name: UsageRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UsageRecord" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "serviceId" text NOT NULL,
    "metricKey" text NOT NULL,
    quantity bigint NOT NULL,
    "occurredAt" timestamp with time zone NOT NULL,
    "idempotencyKey" text NOT NULL,
    "invoiceLineId" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."UsageRecord" FORCE ROW LEVEL SECURITY;


--
-- Name: VerificationCase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationCase" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "subjectId" text NOT NULL,
    "policyId" text NOT NULL,
    status public."CaseStatus" DEFAULT 'PENDING'::public."CaseStatus" NOT NULL,
    "temporalWorkflowId" text,
    decision text,
    "reviewerId" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "resolvedAt" timestamp with time zone,
    "claimType" public."ClaimType" DEFAULT 'IDENTITY'::public."ClaimType" NOT NULL,
    level public."VerificationLevel" DEFAULT 'SELF_ATTESTED'::public."VerificationLevel" NOT NULL
);

ALTER TABLE ONLY public."VerificationCase" FORCE ROW LEVEL SECURITY;


--
-- Name: VerificationMethodAttempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationMethodAttempt" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "caseId" text NOT NULL,
    method text NOT NULL,
    status public."AttemptStatus" DEFAULT 'PENDING'::public."AttemptStatus" NOT NULL,
    "providerKey" text NOT NULL,
    "resultMeta" jsonb,
    score double precision,
    "startedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "completedAt" timestamp with time zone,
    raw jsonb
);

ALTER TABLE ONLY public."VerificationMethodAttempt" FORCE ROW LEVEL SECURITY;


--
-- Name: VerificationPolicy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationPolicy" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    methods text[] NOT NULL,
    "requireAll" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "claimType" public."ClaimType" DEFAULT 'IDENTITY'::public."ClaimType" NOT NULL,
    level public."VerificationLevel" DEFAULT 'SELF_ATTESTED'::public."VerificationLevel" NOT NULL
);

ALTER TABLE ONLY public."VerificationPolicy" FORCE ROW LEVEL SECURITY;


--
-- Name: VerificationSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationSession" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "caseId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public."VerificationSession" FORCE ROW LEVEL SECURITY;


--
-- Name: VerifiedAttribute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerifiedAttribute" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "subjectId" text NOT NULL,
    attribute public."AttributeType" NOT NULL,
    level public."VerificationLevel" NOT NULL,
    method text NOT NULL,
    "caseId" text NOT NULL,
    "verifiedAt" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public."VerifiedAttribute" FORCE ROW LEVEL SECURITY;


--
-- Name: WebhookEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WebhookEvent" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    provider text NOT NULL,
    "providerEventId" text NOT NULL,
    type text NOT NULL,
    payload jsonb NOT NULL,
    "signatureValid" boolean NOT NULL,
    status public."WebhookEventStatus" DEFAULT 'RECEIVED'::public."WebhookEventStatus" NOT NULL,
    error text,
    "receivedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "processedAt" timestamp with time zone
);

ALTER TABLE ONLY public."WebhookEvent" FORCE ROW LEVEL SECURITY;


--
-- Name: access_grant; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.access_grant AS
 SELECT id,
    "accountId" AS account_id,
    "tenantId" AS tenant_id,
    "organizationId" AS organization_id,
    "brandId" AS brand_id,
    ("accessType")::text AS access_type,
    "partnershipPercentage" AS partnership_percentage,
    "grantedBy" AS granted_by,
    (status)::text AS status,
    "grantedAt" AS granted_at
   FROM public."AccessGrant";


--
-- Name: account; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.account AS
 SELECT id,
    phone,
    email,
    "phoneVerifiedAt" AS phone_verified_at,
    "emailVerifiedAt" AS email_verified_at,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."Account";


--
-- Name: account_email_otp_code; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.account_email_otp_code AS
 SELECT id,
    "accountId" AS account_id,
    email,
    "codeHash" AS code_hash,
    attempts,
    "consumedAt" AS consumed_at,
    "expiresAt" AS expires_at,
    "createdAt" AS created_at
   FROM public."AccountEmailOtpCode";


--
-- Name: account_otp_code; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.account_otp_code AS
 SELECT id,
    phone,
    "codeHash" AS code_hash,
    attempts,
    "consumedAt" AS consumed_at,
    "expiresAt" AS expires_at,
    "createdAt" AS created_at
   FROM public."AccountOtpCode";


--
-- Name: account_session; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.account_session AS
 SELECT id,
    "accountId" AS account_id,
    "tokenHash" AS token_hash,
    "expiresAt" AS expires_at,
    "createdAt" AS created_at
   FROM public."AccountSession";


--
-- Name: appointment; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.appointment AS
 SELECT id,
    "profileId" AS profile_id,
    "serviceId" AS service_id,
    (status)::text AS status,
    "startsAt" AS starts_at,
    "endsAt" AS ends_at,
    "visitorName" AS visitor_name,
    "visitorPhone" AS visitor_phone,
    "visitorEmail" AS visitor_email,
    notes,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."Appointment";


--
-- Name: audit_log_entry; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.audit_log_entry AS
 SELECT id,
    "tenantId" AS tenant_id,
    ("actorType")::text AS actor_type,
    "actorId" AS actor_id,
    action,
    "subjectId" AS subject_id,
    "caseId" AS case_id,
    "ipAddress" AS ip_address,
    "entityType" AS entity_type,
    "entityId" AS entity_id,
    metadata,
    "createdAt" AS created_at
   FROM public."AuditLogEntry";


--
-- Name: availability_rule; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.availability_rule AS
 SELECT id,
    "profileId" AS profile_id,
    (day)::text AS day,
    "startMinute" AS start_minute,
    "endMinute" AS end_minute,
    "isActive" AS is_active
   FROM public."AvailabilityRule";


--
-- Name: billing_account; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.billing_account AS
 SELECT id,
    "tenantId" AS tenant_id,
    currency,
    (status)::text AS status,
    "creditBalanceMinor" AS credit_balance_minor,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."BillingAccount";


--
-- Name: billing_invoice_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.billing_invoice_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: billing_service; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.billing_service AS
 SELECT id,
    key,
    name,
    "ownerRepo" AS owner_repo,
    (status)::text AS status,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."BillingService";


--
-- Name: billing_service_credential; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.billing_service_credential AS
 SELECT id,
    "serviceId" AS service_id,
    label,
    "keyPrefix" AS key_prefix,
    "keyHash" AS key_hash,
    scopes,
    "lastUsedAt" AS last_used_at,
    "revokedAt" AS revoked_at,
    "createdAt" AS created_at
   FROM public."BillingServiceCredential";


--
-- Name: brand; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.brand AS
 SELECT id,
    "organizationId" AS organization_id,
    name,
    slug,
    description,
    bio,
    "logoKey" AS logo_key,
    "primaryColor" AS primary_color,
    "secondaryColor" AS secondary_color,
    website,
    email,
    phone,
    address,
    colors,
    "socialLinks" AS social_links,
    products,
    services,
    prices,
    policies,
    rules,
    "toneGuidelines" AS tone_guidelines,
    keywords,
    active,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."Brand";


--
-- Name: business_hour; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.business_hour AS
 SELECT id,
    "profileId" AS profile_id,
    (day)::text AS day,
    "openMinute" AS open_minute,
    "closeMinute" AS close_minute,
    "isClosed" AS is_closed
   FROM public."BusinessHour";


--
-- Name: checkout_session; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.checkout_session AS
 SELECT id,
    "tenantId" AS tenant_id,
    "paymentIntentId" AS payment_intent_id,
    "tokenHash" AS token_hash,
    (status)::text AS status,
    "returnUrl" AS return_url,
    "expiresAt" AS expires_at,
    "consumedAt" AS consumed_at,
    "createdAt" AS created_at
   FROM public."CheckoutSession";


--
-- Name: contact_message; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.contact_message AS
 SELECT id,
    "profileId" AS profile_id,
    "senderName" AS sender_name,
    "senderPhone" AS sender_phone,
    "senderEmail" AS sender_email,
    message,
    "readAt" AS read_at,
    "createdAt" AS created_at
   FROM public."ContactMessage";


--
-- Name: credit_ledger_entry; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.credit_ledger_entry AS
 SELECT id,
    "tenantId" AS tenant_id,
    "billingAccountId" AS billing_account_id,
    "deltaMinor" AS delta_minor,
    (reason)::text AS reason,
    "refType" AS ref_type,
    "refId" AS ref_id,
    "balanceAfterMinor" AS balance_after_minor,
    "createdAt" AS created_at
   FROM public."CreditLedgerEntry";


--
-- Name: custom_link; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.custom_link AS
 SELECT id,
    "profileId" AS profile_id,
    label,
    url,
    "order",
    "createdAt" AS created_at
   FROM public."CustomLink";


--
-- Name: department; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.department AS
 SELECT id,
    "tenantId" AS tenant_id,
    name,
    slug,
    "defaultPermissions" AS default_permissions,
    icon,
    color,
    "inheritedFromTenant" AS inherited_from_tenant,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."Department";


--
-- Name: department_assignment; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.department_assignment AS
 SELECT id,
    "accountId" AS account_id,
    "departmentId" AS department_id,
    "tenantId" AS tenant_id,
    "organizationId" AS organization_id,
    "brandId" AS brand_id,
    (scope)::text AS scope,
    "createdAt" AS created_at
   FROM public."DepartmentAssignment";


--
-- Name: document_asset; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.document_asset AS
 SELECT id,
    "tenantId" AS tenant_id,
    "methodAttemptId" AS method_attempt_id,
    "storageKey" AS storage_key,
    "contentType" AS content_type,
    "sizeBytes" AS size_bytes,
    "createdAt" AS created_at
   FROM public."DocumentAsset";


--
-- Name: invitation; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.invitation AS
 SELECT id,
    "tenantId" AS tenant_id,
    email,
    username,
    "invitedBy" AS invited_by,
    "organizationId" AS organization_id,
    "brandId" AS brand_id,
    (scope)::text AS scope,
    "roleDefinitionId" AS role_definition_id,
    "departmentId" AS department_id,
    (status)::text AS status,
    "expiresAt" AS expires_at,
    "acceptedAt" AS accepted_at,
    "acceptedBy" AS accepted_by,
    "createdAt" AS created_at
   FROM public."Invitation";


--
-- Name: invoice; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.invoice AS
 SELECT id,
    "tenantId" AS tenant_id,
    "billingAccountId" AS billing_account_id,
    number,
    (status)::text AS status,
    currency,
    "subtotalMinor" AS subtotal_minor,
    "taxMinor" AS tax_minor,
    "totalMinor" AS total_minor,
    "amountPaidMinor" AS amount_paid_minor,
    "periodStart" AS period_start,
    "periodEnd" AS period_end,
    "dueAt" AS due_at,
    "issuedAt" AS issued_at,
    "paidAt" AS paid_at,
    "voidedAt" AS voided_at,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."Invoice";


--
-- Name: invoice_line; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.invoice_line AS
 SELECT id,
    "tenantId" AS tenant_id,
    "invoiceId" AS invoice_id,
    "serviceId" AS service_id,
    "subscriptionId" AS subscription_id,
    description,
    quantity,
    "unitAmountMinor" AS unit_amount_minor,
    "amountMinor" AS amount_minor,
    "taxMinor" AS tax_minor,
    "createdAt" AS created_at
   FROM public."InvoiceLine";


--
-- Name: ledger_account; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ledger_account AS
 SELECT id,
    "tenantId" AS tenant_id,
    "serviceId" AS service_id,
    (kind)::text AS kind,
    currency,
    "scopeKey" AS scope_key,
    "createdAt" AS created_at
   FROM public."LedgerAccount";


--
-- Name: ledger_entry; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ledger_entry AS
 SELECT id,
    "tenantId" AS tenant_id,
    "transactionId" AS transaction_id,
    "accountId" AS account_id,
    (direction)::text AS direction,
    "amountMinor" AS amount_minor
   FROM public."LedgerEntry";


--
-- Name: ledger_transaction; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ledger_transaction AS
 SELECT id,
    "tenantId" AS tenant_id,
    (type)::text AS type,
    "refType" AS ref_type,
    "refId" AS ref_id,
    currency,
    "occurredAt" AS occurred_at,
    "createdAt" AS created_at
   FROM public."LedgerTransaction";


--
-- Name: oauth_client; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.oauth_client AS
 SELECT id,
    "tenantId" AS tenant_id,
    name,
    "clientId" AS client_id,
    "clientSecretHash" AS client_secret_hash,
    "redirectUris" AS redirect_uris,
    "createdAt" AS created_at
   FROM public."OAuthClient";


--
-- Name: oauth_login_request; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.oauth_login_request AS
 SELECT id,
    "tenantId" AS tenant_id,
    "clientId" AS client_id,
    "redirectUri" AS redirect_uri,
    state,
    (status)::text AS status,
    "accountId" AS account_id,
    "pollTokenHash" AS poll_token_hash,
    "codeHash" AS code_hash,
    "codeConsumedAt" AS code_consumed_at,
    "createdAt" AS created_at,
    "expiresAt" AS expires_at
   FROM public."OAuthLoginRequest";


--
-- Name: offer; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.offer AS
 SELECT id,
    "profileId" AS profile_id,
    title,
    description,
    "imageKey" AS image_key,
    "validUntil" AS valid_until,
    "isActive" AS is_active,
    "createdAt" AS created_at
   FROM public."Offer";


--
-- Name: organization; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.organization AS
 SELECT id,
    "tenantId" AS tenant_id,
    "subjectId" AS subject_id,
    "legalName" AS legal_name,
    "registrationNumber" AS registration_number,
    "countryCode" AS country_code,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."Organization";


--
-- Name: organization_beneficial_owner; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.organization_beneficial_owner AS
 SELECT id,
    "tenantId" AS tenant_id,
    "organizationId" AS organization_id,
    "personSubjectId" AS person_subject_id,
    role,
    "createdAt" AS created_at
   FROM public."OrganizationBeneficialOwner";


--
-- Name: organization_membership; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.organization_membership AS
 SELECT id,
    "tenantId" AS tenant_id,
    "organizationId" AS organization_id,
    "personSubjectId" AS person_subject_id,
    role,
    (status)::text AS status,
    "isAdmin" AS is_admin,
    "accountId" AS account_id,
    "addedByApiKeyId" AS added_by_api_key_id,
    "createdAt" AS created_at,
    "respondedAt" AS responded_at
   FROM public."OrganizationMembership";


--
-- Name: outbound_event; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.outbound_event AS
 SELECT id,
    "tenantId" AS tenant_id,
    "serviceId" AS service_id,
    "eventType" AS event_type,
    payload,
    "targetUrl" AS target_url,
    (status)::text AS status,
    attempts,
    "nextAttemptAt" AS next_attempt_at,
    "lastError" AS last_error,
    "createdAt" AS created_at,
    "deliveredAt" AS delivered_at
   FROM public."OutboundEvent";


--
-- Name: payment; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.payment AS
 SELECT id,
    "tenantId" AS tenant_id,
    "paymentIntentId" AS payment_intent_id,
    provider,
    "providerTransactionId" AS provider_transaction_id,
    "amountMinor" AS amount_minor,
    currency,
    (status)::text AS status,
    "methodType" AS method_type,
    "paidAt" AS paid_at,
    "createdAt" AS created_at
   FROM public."Payment";


--
-- Name: payment_intent; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.payment_intent AS
 SELECT id,
    "tenantId" AS tenant_id,
    "billingAccountId" AS billing_account_id,
    (purpose)::text AS purpose,
    "amountMinor" AS amount_minor,
    currency,
    (status)::text AS status,
    provider,
    "providerRef" AS provider_ref,
    "checkoutUrl" AS checkout_url,
    "idempotencyKey" AS idempotency_key,
    metadata,
    "expiresAt" AS expires_at,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."PaymentIntent";


--
-- Name: permission_catalog; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.permission_catalog AS
 SELECT id,
    "groupName" AS group_name,
    "serviceName" AS service_name,
    "permissionKey" AS permission_key,
    label,
    description,
    "createdAt" AS created_at
   FROM public."PermissionCatalog";


--
-- Name: phone_badge_evidence; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.phone_badge_evidence AS
 SELECT id,
    phone,
    "tenantId" AS tenant_id,
    "subjectId" AS subject_id,
    "caseId" AS case_id,
    ("claimType")::text AS claim_type,
    (level)::text AS level,
    "verifiedAt" AS verified_at,
    "createdAt" AS created_at
   FROM public."PhoneBadgeEvidence";


--
-- Name: phone_name_evidence; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.phone_name_evidence AS
 SELECT id,
    phone,
    "tenantId" AS tenant_id,
    "subjectId" AS subject_id,
    "caseId" AS case_id,
    method,
    "givenName" AS given_name,
    "familyName" AS family_name,
    "verifiedAt" AS verified_at,
    "createdAt" AS created_at
   FROM public."PhoneNameEvidence";


--
-- Name: plan; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.plan AS
 SELECT id,
    "serviceId" AS service_id,
    key,
    version,
    name,
    description,
    (mode)::text AS mode,
    currency,
    "unitAmountMinor" AS unit_amount_minor,
    ("interval")::text AS "interval",
    "creditsIncluded" AS credits_included,
    "overageUnitAmountMinor" AS overage_unit_amount_minor,
    features,
    (status)::text AS status,
    "supersedesPlanId" AS supersedes_plan_id,
    "createdAt" AS created_at
   FROM public."Plan";


--
-- Name: profile; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profile AS
 SELECT id,
    "accountId" AS account_id,
    "organizationId" AS organization_id,
    slug,
    "displayName" AS display_name,
    headline,
    (category)::text AS category,
    bio,
    "photoKey" AS photo_key,
    "photoContentType" AS photo_content_type,
    phone,
    whatsapp,
    "publicEmail" AS public_email,
    "addressLine1" AS address_line1,
    "addressLine2" AS address_line2,
    city,
    region,
    "countryCode" AS country_code,
    latitude,
    longitude,
    timezone,
    "showPhone" AS show_phone,
    "showWhatsapp" AS show_whatsapp,
    "showEmail" AS show_email,
    "showAddress" AS show_address,
    "showBadges" AS show_badges,
    "showBooking" AS show_booking,
    "showOffers" AS show_offers,
    "showHours" AS show_hours,
    "showRealName" AS show_real_name,
    "isPublished" AS is_published,
    "usernameSetAt" AS username_set_at,
    "usernameSourceName" AS username_source_name,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."Profile";


--
-- Name: profile_field_grant; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profile_field_grant AS
 SELECT id,
    "profileId" AS profile_id,
    (field)::text AS field,
    "granteeAccountId" AS grantee_account_id,
    "granteeOrganizationId" AS grantee_organization_id,
    "createdAt" AS created_at,
    "revokedAt" AS revoked_at
   FROM public."ProfileFieldGrant";


--
-- Name: profile_image; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profile_image AS
 SELECT id,
    "profileId" AS profile_id,
    (kind)::text AS kind,
    "storageKey" AS storage_key,
    "contentType" AS content_type,
    "order",
    "createdAt" AS created_at
   FROM public."ProfileImage";


--
-- Name: refund; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.refund AS
 SELECT id,
    "tenantId" AS tenant_id,
    "paymentId" AS payment_id,
    "amountMinor" AS amount_minor,
    (status)::text AS status,
    reason,
    "providerRef" AS provider_ref,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."Refund";


--
-- Name: role_assignment; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.role_assignment AS
 SELECT id,
    "accountId" AS account_id,
    "roleDefinitionId" AS role_definition_id,
    "tenantId" AS tenant_id,
    "organizationId" AS organization_id,
    "brandId" AS brand_id,
    (scope)::text AS scope,
    "createdAt" AS created_at
   FROM public."RoleAssignment";


--
-- Name: role_definition; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.role_definition AS
 SELECT id,
    "tenantId" AS tenant_id,
    name,
    slug,
    permissions,
    description,
    "isSystem" AS is_system,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."RoleDefinition";


--
-- Name: service; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.service AS
 SELECT id,
    "profileId" AS profile_id,
    name,
    description,
    "durationMinutes" AS duration_minutes,
    price,
    currency,
    "isActive" AS is_active,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."Service";


--
-- Name: settlement_record; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.settlement_record AS
 SELECT id,
    provider,
    "providerSettlementId" AS provider_settlement_id,
    "amountMinor" AS amount_minor,
    "feeMinor" AS fee_minor,
    "netMinor" AS net_minor,
    currency,
    "settledAt" AS settled_at,
    "matchedPaymentId" AS matched_payment_id,
    "matchedTenantId" AS matched_tenant_id,
    (status)::text AS status,
    "createdAt" AS created_at
   FROM public."SettlementRecord";


--
-- Name: social_link; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.social_link AS
 SELECT id,
    "profileId" AS profile_id,
    (platform)::text AS platform,
    url,
    "order"
   FROM public."SocialLink";


--
-- Name: subject; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.subject AS
 SELECT id,
    "tenantId" AS tenant_id,
    "externalRef" AS external_ref,
    (type)::text AS type,
    "givenName" AS given_name,
    "familyName" AS family_name,
    email,
    phone,
    "dateOfBirth" AS date_of_birth,
    "nationalIdNumber" AS national_id_number,
    "addressLine1" AS address_line1,
    "addressLine2" AS address_line2,
    city,
    region,
    "countryCode" AS country_code,
    latitude,
    longitude,
    "accountId" AS account_id,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."Subject";


--
-- Name: subscription; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.subscription AS
 SELECT id,
    "tenantId" AS tenant_id,
    "billingAccountId" AS billing_account_id,
    "planId" AS plan_id,
    (status)::text AS status,
    "currentPeriodStart" AS current_period_start,
    "currentPeriodEnd" AS current_period_end,
    "cancelAtPeriodEnd" AS cancel_at_period_end,
    "startedAt" AS started_at,
    "canceledAt" AS canceled_at,
    "providerTokenId" AS provider_token_id,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."Subscription";


--
-- Name: tenant; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.tenant AS
 SELECT id,
    name,
    slug,
    "dataResidencyRegion" AS data_residency_region,
    "webhookUrl" AS webhook_url,
    "webhookSecretPlaintext" AS webhook_secret_plaintext,
    "billingWebhookUrl" AS billing_webhook_url,
    "billingWebhookSecretPlaintext" AS billing_webhook_secret_plaintext,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."Tenant";


--
-- Name: tenant_api_key; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.tenant_api_key AS
 SELECT id,
    "tenantId" AS tenant_id,
    "keyPrefix" AS key_prefix,
    "keyHash" AS key_hash,
    scopes,
    "rateLimitPerMinute" AS rate_limit_per_minute,
    "revokedAt" AS revoked_at,
    "createdAt" AS created_at
   FROM public."TenantApiKey";


--
-- Name: tenant_staff_membership; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.tenant_staff_membership AS
 SELECT id,
    "tenantId" AS tenant_id,
    "accountId" AS account_id,
    role,
    "createdAt" AS created_at
   FROM public."TenantStaffMembership";


--
-- Name: usage_record; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.usage_record AS
 SELECT id,
    "tenantId" AS tenant_id,
    "serviceId" AS service_id,
    "metricKey" AS metric_key,
    quantity,
    "occurredAt" AS occurred_at,
    "idempotencyKey" AS idempotency_key,
    "invoiceLineId" AS invoice_line_id,
    "createdAt" AS created_at
   FROM public."UsageRecord";


--
-- Name: verification_case; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.verification_case AS
 SELECT id,
    "tenantId" AS tenant_id,
    "subjectId" AS subject_id,
    "policyId" AS policy_id,
    (status)::text AS status,
    "temporalWorkflowId" AS temporal_workflow_id,
    decision,
    "reviewerId" AS reviewer_id,
    ("claimType")::text AS claim_type,
    (level)::text AS level,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at,
    "resolvedAt" AS resolved_at
   FROM public."VerificationCase";


--
-- Name: verification_method_attempt; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.verification_method_attempt AS
 SELECT id,
    "tenantId" AS tenant_id,
    "caseId" AS case_id,
    method,
    (status)::text AS status,
    "providerKey" AS provider_key,
    "resultMeta" AS result_meta,
    raw,
    score,
    "startedAt" AS started_at,
    "completedAt" AS completed_at
   FROM public."VerificationMethodAttempt";


--
-- Name: verification_policy; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.verification_policy AS
 SELECT id,
    "tenantId" AS tenant_id,
    name,
    methods,
    "requireAll" AS require_all,
    ("claimType")::text AS claim_type,
    (level)::text AS level,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
   FROM public."VerificationPolicy";


--
-- Name: verification_session; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.verification_session AS
 SELECT id,
    "tenantId" AS tenant_id,
    "caseId" AS case_id,
    "tokenHash" AS token_hash,
    "expiresAt" AS expires_at,
    "createdAt" AS created_at
   FROM public."VerificationSession";


--
-- Name: verified_attribute; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.verified_attribute AS
 SELECT id,
    "tenantId" AS tenant_id,
    "subjectId" AS subject_id,
    (attribute)::text AS attribute,
    (level)::text AS level,
    method,
    "caseId" AS case_id,
    "verifiedAt" AS verified_at
   FROM public."VerifiedAttribute";


--
-- Name: webhook_event; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.webhook_event AS
 SELECT id,
    "tenantId" AS tenant_id,
    provider,
    "providerEventId" AS provider_event_id,
    type,
    payload,
    "signatureValid" AS signature_valid,
    (status)::text AS status,
    error,
    "receivedAt" AS received_at,
    "processedAt" AS processed_at
   FROM public."WebhookEvent";


--
-- Name: access_grant status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_grant ALTER COLUMN status SET DEFAULT ('ACTIVE'::public."AccessGrantStatus")::text;


--
-- Name: access_grant granted_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_grant ALTER COLUMN granted_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: appointment status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment ALTER COLUMN status SET DEFAULT ('PENDING'::public."AppointmentStatus")::text;


--
-- Name: appointment created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: appointment updated_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: audit_log_entry created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_entry ALTER COLUMN created_at SET DEFAULT now();


--
-- Name: availability_rule is_active; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_rule ALTER COLUMN is_active SET DEFAULT true;


--
-- Name: billing_account currency; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_account ALTER COLUMN currency SET DEFAULT 'PKR'::text;


--
-- Name: billing_account status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_account ALTER COLUMN status SET DEFAULT ('ACTIVE'::public."BillingAccountStatus")::text;


--
-- Name: billing_account credit_balance_minor; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_account ALTER COLUMN credit_balance_minor SET DEFAULT 0;


--
-- Name: billing_account created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_account ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: billing_account updated_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_account ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: billing_service status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_service ALTER COLUMN status SET DEFAULT ('ACTIVE'::public."BillingServiceStatus")::text;


--
-- Name: billing_service created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_service ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: billing_service updated_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_service ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: business_hour is_closed; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_hour ALTER COLUMN is_closed SET DEFAULT false;


--
-- Name: checkout_session status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_session ALTER COLUMN status SET DEFAULT ('PENDING'::public."CheckoutSessionStatus")::text;


--
-- Name: checkout_session created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_session ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: credit_ledger_entry created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_ledger_entry ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: department_assignment scope; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_assignment ALTER COLUMN scope SET DEFAULT ('TENANT'::public."AccessScope")::text;


--
-- Name: department_assignment created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_assignment ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: invitation status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation ALTER COLUMN status SET DEFAULT ('PENDING'::public."InvitationStatus")::text;


--
-- Name: invitation created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: invoice status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice ALTER COLUMN status SET DEFAULT ('DRAFT'::public."InvoiceStatus")::text;


--
-- Name: invoice tax_minor; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice ALTER COLUMN tax_minor SET DEFAULT 0;


--
-- Name: invoice amount_paid_minor; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice ALTER COLUMN amount_paid_minor SET DEFAULT 0;


--
-- Name: invoice created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: invoice updated_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: ledger_account created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_account ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: ledger_transaction created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_transaction ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: oauth_login_request status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_login_request ALTER COLUMN status SET DEFAULT ('PENDING'::public."LoginRequestStatus")::text;


--
-- Name: oauth_login_request created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_login_request ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: organization_membership status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_membership ALTER COLUMN status SET DEFAULT ('ACTIVE'::public."MembershipStatus")::text;


--
-- Name: organization_membership is_admin; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_membership ALTER COLUMN is_admin SET DEFAULT false;


--
-- Name: organization_membership created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_membership ALTER COLUMN created_at SET DEFAULT now();


--
-- Name: outbound_event status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbound_event ALTER COLUMN status SET DEFAULT ('PENDING'::public."OutboundEventStatus")::text;


--
-- Name: outbound_event attempts; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbound_event ALTER COLUMN attempts SET DEFAULT 0;


--
-- Name: outbound_event created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbound_event ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: payment status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment ALTER COLUMN status SET DEFAULT ('PENDING'::public."PaymentStatus")::text;


--
-- Name: payment created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: payment_intent status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intent ALTER COLUMN status SET DEFAULT ('REQUIRES_CHECKOUT'::public."PaymentIntentStatus")::text;


--
-- Name: payment_intent created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intent ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: payment_intent updated_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intent ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: phone_badge_evidence created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_badge_evidence ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: plan version; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan ALTER COLUMN version SET DEFAULT 1;


--
-- Name: plan currency; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan ALTER COLUMN currency SET DEFAULT 'PKR'::text;


--
-- Name: plan credits_included; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan ALTER COLUMN credits_included SET DEFAULT 0;


--
-- Name: plan features; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan ALTER COLUMN features SET DEFAULT '{}'::jsonb;


--
-- Name: plan status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan ALTER COLUMN status SET DEFAULT ('ACTIVE'::public."PlanStatus")::text;


--
-- Name: plan created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: profile category; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN category SET DEFAULT ('OTHER'::public."ProfileCategory")::text;


--
-- Name: profile timezone; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN timezone SET DEFAULT 'UTC'::text;


--
-- Name: profile show_phone; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN show_phone SET DEFAULT false;


--
-- Name: profile show_whatsapp; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN show_whatsapp SET DEFAULT false;


--
-- Name: profile show_email; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN show_email SET DEFAULT false;


--
-- Name: profile show_address; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN show_address SET DEFAULT false;


--
-- Name: profile show_badges; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN show_badges SET DEFAULT true;


--
-- Name: profile show_booking; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN show_booking SET DEFAULT true;


--
-- Name: profile show_offers; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN show_offers SET DEFAULT true;


--
-- Name: profile show_hours; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN show_hours SET DEFAULT true;


--
-- Name: profile show_real_name; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN show_real_name SET DEFAULT false;


--
-- Name: profile is_published; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN is_published SET DEFAULT false;


--
-- Name: profile username_set_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN username_set_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: profile username_source_name; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN username_source_name SET DEFAULT ''::text;


--
-- Name: profile created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: profile updated_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: profile_field_grant created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_field_grant ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: profile_image order; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_image ALTER COLUMN "order" SET DEFAULT 0;


--
-- Name: profile_image created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_image ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: refund status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund ALTER COLUMN status SET DEFAULT ('PENDING'::public."RefundStatus")::text;


--
-- Name: refund created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: refund updated_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: role_assignment scope; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_assignment ALTER COLUMN scope SET DEFAULT ('TENANT'::public."AccessScope")::text;


--
-- Name: role_assignment created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_assignment ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: settlement_record status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_record ALTER COLUMN status SET DEFAULT ('DISCREPANCY'::public."SettlementStatus")::text;


--
-- Name: settlement_record created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_record ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: social_link order; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_link ALTER COLUMN "order" SET DEFAULT 0;


--
-- Name: subject created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject ALTER COLUMN created_at SET DEFAULT now();


--
-- Name: subject updated_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: subscription status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription ALTER COLUMN status SET DEFAULT ('INCOMPLETE'::public."SubscriptionStatus")::text;


--
-- Name: subscription cancel_at_period_end; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription ALTER COLUMN cancel_at_period_end SET DEFAULT false;


--
-- Name: subscription created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: subscription updated_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: verification_case status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_case ALTER COLUMN status SET DEFAULT ('PENDING'::public."CaseStatus")::text;


--
-- Name: verification_case claim_type; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_case ALTER COLUMN claim_type SET DEFAULT ('IDENTITY'::public."ClaimType")::text;


--
-- Name: verification_case level; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_case ALTER COLUMN level SET DEFAULT ('SELF_ATTESTED'::public."VerificationLevel")::text;


--
-- Name: verification_case created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_case ALTER COLUMN created_at SET DEFAULT now();


--
-- Name: verification_case updated_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_case ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: verification_method_attempt status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_method_attempt ALTER COLUMN status SET DEFAULT ('PENDING'::public."AttemptStatus")::text;


--
-- Name: verification_method_attempt started_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_method_attempt ALTER COLUMN started_at SET DEFAULT now();


--
-- Name: verification_policy require_all; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_policy ALTER COLUMN require_all SET DEFAULT true;


--
-- Name: verification_policy claim_type; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_policy ALTER COLUMN claim_type SET DEFAULT ('IDENTITY'::public."ClaimType")::text;


--
-- Name: verification_policy level; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_policy ALTER COLUMN level SET DEFAULT ('SELF_ATTESTED'::public."VerificationLevel")::text;


--
-- Name: verification_policy created_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_policy ALTER COLUMN created_at SET DEFAULT now();


--
-- Name: verification_policy updated_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_policy ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: verified_attribute verified_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verified_attribute ALTER COLUMN verified_at SET DEFAULT now();


--
-- Name: webhook_event status; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_event ALTER COLUMN status SET DEFAULT ('RECEIVED'::public."WebhookEventStatus")::text;


--
-- Name: webhook_event received_at; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_event ALTER COLUMN received_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: AccessGrant AccessGrant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccessGrant"
    ADD CONSTRAINT "AccessGrant_pkey" PRIMARY KEY (id);


--
-- Name: AccountEmailOtpCode AccountEmailOtpCode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccountEmailOtpCode"
    ADD CONSTRAINT "AccountEmailOtpCode_pkey" PRIMARY KEY (id);


--
-- Name: AccountOtpCode AccountOtpCode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccountOtpCode"
    ADD CONSTRAINT "AccountOtpCode_pkey" PRIMARY KEY (id);


--
-- Name: AccountSession AccountSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccountSession"
    ADD CONSTRAINT "AccountSession_pkey" PRIMARY KEY (id);


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: Appointment Appointment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_pkey" PRIMARY KEY (id);


--
-- Name: AuditLogEntry AuditLogEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLogEntry"
    ADD CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY (id);


--
-- Name: AvailabilityRule AvailabilityRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AvailabilityRule"
    ADD CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY (id);


--
-- Name: BillingAccount BillingAccount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BillingAccount"
    ADD CONSTRAINT "BillingAccount_pkey" PRIMARY KEY (id);


--
-- Name: BillingServiceCredential BillingServiceCredential_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BillingServiceCredential"
    ADD CONSTRAINT "BillingServiceCredential_pkey" PRIMARY KEY (id);


--
-- Name: BillingService BillingService_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BillingService"
    ADD CONSTRAINT "BillingService_pkey" PRIMARY KEY (id);


--
-- Name: Brand Brand_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Brand"
    ADD CONSTRAINT "Brand_pkey" PRIMARY KEY (id);


--
-- Name: BusinessHour BusinessHour_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessHour"
    ADD CONSTRAINT "BusinessHour_pkey" PRIMARY KEY (id);


--
-- Name: CheckoutSession CheckoutSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CheckoutSession"
    ADD CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY (id);


--
-- Name: ContactMessage ContactMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContactMessage"
    ADD CONSTRAINT "ContactMessage_pkey" PRIMARY KEY (id);


--
-- Name: CreditLedgerEntry CreditLedgerEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreditLedgerEntry"
    ADD CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY (id);


--
-- Name: CustomLink CustomLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomLink"
    ADD CONSTRAINT "CustomLink_pkey" PRIMARY KEY (id);


--
-- Name: DepartmentAssignment DepartmentAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DepartmentAssignment"
    ADD CONSTRAINT "DepartmentAssignment_pkey" PRIMARY KEY (id);


--
-- Name: Department Department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_pkey" PRIMARY KEY (id);


--
-- Name: DocumentAsset DocumentAsset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentAsset"
    ADD CONSTRAINT "DocumentAsset_pkey" PRIMARY KEY (id);


--
-- Name: Invitation Invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceLine InvoiceLine_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: LedgerAccount LedgerAccount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerAccount"
    ADD CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY (id);


--
-- Name: LedgerEntry LedgerEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY (id);


--
-- Name: LedgerTransaction LedgerTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerTransaction"
    ADD CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY (id);


--
-- Name: OAuthClient OAuthClient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OAuthClient"
    ADD CONSTRAINT "OAuthClient_pkey" PRIMARY KEY (id);


--
-- Name: OAuthLoginRequest OAuthLoginRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OAuthLoginRequest"
    ADD CONSTRAINT "OAuthLoginRequest_pkey" PRIMARY KEY (id);


--
-- Name: Offer Offer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offer"
    ADD CONSTRAINT "Offer_pkey" PRIMARY KEY (id);


--
-- Name: OrganizationBeneficialOwner OrganizationBeneficialOwner_organizationId_personSubjectId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrganizationBeneficialOwner"
    ADD CONSTRAINT "OrganizationBeneficialOwner_organizationId_personSubjectId_key" UNIQUE ("organizationId", "personSubjectId");


--
-- Name: OrganizationBeneficialOwner OrganizationBeneficialOwner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrganizationBeneficialOwner"
    ADD CONSTRAINT "OrganizationBeneficialOwner_pkey" PRIMARY KEY (id);


--
-- Name: OrganizationMembership OrganizationMembership_organizationId_personSubjectId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrganizationMembership"
    ADD CONSTRAINT "OrganizationMembership_organizationId_personSubjectId_key" UNIQUE ("organizationId", "personSubjectId");


--
-- Name: OrganizationMembership OrganizationMembership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrganizationMembership"
    ADD CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY (id);


--
-- Name: Organization Organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_pkey" PRIMARY KEY (id);


--
-- Name: Organization Organization_subjectId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_subjectId_key" UNIQUE ("subjectId");


--
-- Name: OutboundEvent OutboundEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OutboundEvent"
    ADD CONSTRAINT "OutboundEvent_pkey" PRIMARY KEY (id);


--
-- Name: PaymentIntent PaymentIntent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentIntent"
    ADD CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: PermissionCatalog PermissionCatalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PermissionCatalog"
    ADD CONSTRAINT "PermissionCatalog_pkey" PRIMARY KEY (id);


--
-- Name: PhoneBadgeEvidence PhoneBadgeEvidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PhoneBadgeEvidence"
    ADD CONSTRAINT "PhoneBadgeEvidence_pkey" PRIMARY KEY (id);


--
-- Name: PhoneNameEvidence PhoneNameEvidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PhoneNameEvidence"
    ADD CONSTRAINT "PhoneNameEvidence_pkey" PRIMARY KEY (id);


--
-- Name: Plan Plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Plan"
    ADD CONSTRAINT "Plan_pkey" PRIMARY KEY (id);


--
-- Name: ProfileFieldGrant ProfileFieldGrant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProfileFieldGrant"
    ADD CONSTRAINT "ProfileFieldGrant_pkey" PRIMARY KEY (id);


--
-- Name: ProfileImage ProfileImage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProfileImage"
    ADD CONSTRAINT "ProfileImage_pkey" PRIMARY KEY (id);


--
-- Name: Profile Profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Profile"
    ADD CONSTRAINT "Profile_pkey" PRIMARY KEY (id);


--
-- Name: Refund Refund_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Refund"
    ADD CONSTRAINT "Refund_pkey" PRIMARY KEY (id);


--
-- Name: RoleAssignment RoleAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoleAssignment"
    ADD CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY (id);


--
-- Name: RoleDefinition RoleDefinition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoleDefinition"
    ADD CONSTRAINT "RoleDefinition_pkey" PRIMARY KEY (id);


--
-- Name: Service Service_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_pkey" PRIMARY KEY (id);


--
-- Name: SettlementRecord SettlementRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SettlementRecord"
    ADD CONSTRAINT "SettlementRecord_pkey" PRIMARY KEY (id);


--
-- Name: SocialLink SocialLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SocialLink"
    ADD CONSTRAINT "SocialLink_pkey" PRIMARY KEY (id);


--
-- Name: Subject Subject_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subject"
    ADD CONSTRAINT "Subject_pkey" PRIMARY KEY (id);


--
-- Name: Subscription Subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY (id);


--
-- Name: TenantApiKey TenantApiKey_keyHash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantApiKey"
    ADD CONSTRAINT "TenantApiKey_keyHash_key" UNIQUE ("keyHash");


--
-- Name: TenantApiKey TenantApiKey_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantApiKey"
    ADD CONSTRAINT "TenantApiKey_pkey" PRIMARY KEY (id);


--
-- Name: TenantStaffMembership TenantStaffMembership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantStaffMembership"
    ADD CONSTRAINT "TenantStaffMembership_pkey" PRIMARY KEY (id);


--
-- Name: TenantStaffMembership TenantStaffMembership_tenantId_accountId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantStaffMembership"
    ADD CONSTRAINT "TenantStaffMembership_tenantId_accountId_key" UNIQUE ("tenantId", "accountId");


--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);


--
-- Name: Tenant Tenant_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_slug_key" UNIQUE (slug);


--
-- Name: UsageRecord UsageRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsageRecord"
    ADD CONSTRAINT "UsageRecord_pkey" PRIMARY KEY (id);


--
-- Name: VerificationCase VerificationCase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationCase"
    ADD CONSTRAINT "VerificationCase_pkey" PRIMARY KEY (id);


--
-- Name: VerificationMethodAttempt VerificationMethodAttempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationMethodAttempt"
    ADD CONSTRAINT "VerificationMethodAttempt_pkey" PRIMARY KEY (id);


--
-- Name: VerificationPolicy VerificationPolicy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationPolicy"
    ADD CONSTRAINT "VerificationPolicy_pkey" PRIMARY KEY (id);


--
-- Name: VerificationPolicy VerificationPolicy_tenantId_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationPolicy"
    ADD CONSTRAINT "VerificationPolicy_tenantId_name_key" UNIQUE ("tenantId", name);


--
-- Name: VerificationSession VerificationSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationSession"
    ADD CONSTRAINT "VerificationSession_pkey" PRIMARY KEY (id);


--
-- Name: VerificationSession VerificationSession_tokenHash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationSession"
    ADD CONSTRAINT "VerificationSession_tokenHash_key" UNIQUE ("tokenHash");


--
-- Name: VerifiedAttribute VerifiedAttribute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerifiedAttribute"
    ADD CONSTRAINT "VerifiedAttribute_pkey" PRIMARY KEY (id);


--
-- Name: WebhookEvent WebhookEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WebhookEvent"
    ADD CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY (id);


--
-- Name: AccessGrant_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AccessGrant_accountId_idx" ON public."AccessGrant" USING btree ("accountId");


--
-- Name: AccessGrant_accountId_tenantId_organizationId_brandId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AccessGrant_accountId_tenantId_organizationId_brandId_key" ON public."AccessGrant" USING btree ("accountId", "tenantId", "organizationId", "brandId");


--
-- Name: AccessGrant_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AccessGrant_status_idx" ON public."AccessGrant" USING btree (status);


--
-- Name: AccessGrant_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AccessGrant_tenantId_idx" ON public."AccessGrant" USING btree ("tenantId");


--
-- Name: AccountEmailOtpCode_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AccountEmailOtpCode_accountId_idx" ON public."AccountEmailOtpCode" USING btree ("accountId");


--
-- Name: AccountOtpCode_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AccountOtpCode_phone_idx" ON public."AccountOtpCode" USING btree (phone);


--
-- Name: AccountSession_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AccountSession_accountId_idx" ON public."AccountSession" USING btree ("accountId");


--
-- Name: AccountSession_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AccountSession_tokenHash_key" ON public."AccountSession" USING btree ("tokenHash");


--
-- Name: Account_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_email_key" ON public."Account" USING btree (email);


--
-- Name: Account_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_phone_key" ON public."Account" USING btree (phone);


--
-- Name: Appointment_profileId_startsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Appointment_profileId_startsAt_idx" ON public."Appointment" USING btree ("profileId", "startsAt");


--
-- Name: Appointment_profileId_startsAt_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Appointment_profileId_startsAt_key" ON public."Appointment" USING btree ("profileId", "startsAt");


--
-- Name: Appointment_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Appointment_serviceId_idx" ON public."Appointment" USING btree ("serviceId");


--
-- Name: AuditLogEntry_tenantId_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLogEntry_tenantId_entityType_entityId_idx" ON public."AuditLogEntry" USING btree ("tenantId", "entityType", "entityId");


--
-- Name: AuditLogEntry_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLogEntry_tenantId_idx" ON public."AuditLogEntry" USING btree ("tenantId");


--
-- Name: AuditLogEntry_tenantId_subjectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLogEntry_tenantId_subjectId_idx" ON public."AuditLogEntry" USING btree ("tenantId", "subjectId");


--
-- Name: AvailabilityRule_profileId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AvailabilityRule_profileId_idx" ON public."AvailabilityRule" USING btree ("profileId");


--
-- Name: BillingAccount_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BillingAccount_tenantId_key" ON public."BillingAccount" USING btree ("tenantId");


--
-- Name: BillingServiceCredential_keyHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BillingServiceCredential_keyHash_key" ON public."BillingServiceCredential" USING btree ("keyHash");


--
-- Name: BillingServiceCredential_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BillingServiceCredential_serviceId_idx" ON public."BillingServiceCredential" USING btree ("serviceId");


--
-- Name: BillingService_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BillingService_key_key" ON public."BillingService" USING btree (key);


--
-- Name: Brand_organizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Brand_organizationId_idx" ON public."Brand" USING btree ("organizationId");


--
-- Name: Brand_organizationId_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Brand_organizationId_slug_key" ON public."Brand" USING btree ("organizationId", slug);


--
-- Name: BusinessHour_profileId_day_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BusinessHour_profileId_day_key" ON public."BusinessHour" USING btree ("profileId", day);


--
-- Name: BusinessHour_profileId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BusinessHour_profileId_idx" ON public."BusinessHour" USING btree ("profileId");


--
-- Name: CheckoutSession_paymentIntentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CheckoutSession_paymentIntentId_key" ON public."CheckoutSession" USING btree ("paymentIntentId");


--
-- Name: CheckoutSession_tenantId_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CheckoutSession_tenantId_tokenHash_key" ON public."CheckoutSession" USING btree ("tenantId", "tokenHash");


--
-- Name: ContactMessage_profileId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContactMessage_profileId_idx" ON public."ContactMessage" USING btree ("profileId");


--
-- Name: CreditLedgerEntry_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CreditLedgerEntry_tenantId_createdAt_idx" ON public."CreditLedgerEntry" USING btree ("tenantId", "createdAt");


--
-- Name: CreditLedgerEntry_tenantId_refType_refId_reason_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CreditLedgerEntry_tenantId_refType_refId_reason_key" ON public."CreditLedgerEntry" USING btree ("tenantId", "refType", "refId", reason);


--
-- Name: CustomLink_profileId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomLink_profileId_idx" ON public."CustomLink" USING btree ("profileId");


--
-- Name: DepartmentAssignment_accountId_departmentId_scope_organizat_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DepartmentAssignment_accountId_departmentId_scope_organizat_key" ON public."DepartmentAssignment" USING btree ("accountId", "departmentId", scope, "organizationId", "brandId");


--
-- Name: DepartmentAssignment_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DepartmentAssignment_accountId_idx" ON public."DepartmentAssignment" USING btree ("accountId");


--
-- Name: DepartmentAssignment_departmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DepartmentAssignment_departmentId_idx" ON public."DepartmentAssignment" USING btree ("departmentId");


--
-- Name: DepartmentAssignment_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DepartmentAssignment_tenantId_idx" ON public."DepartmentAssignment" USING btree ("tenantId");


--
-- Name: Department_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Department_tenantId_idx" ON public."Department" USING btree ("tenantId");


--
-- Name: Department_tenantId_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Department_tenantId_slug_key" ON public."Department" USING btree ("tenantId", slug);


--
-- Name: DocumentAsset_methodAttemptId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentAsset_methodAttemptId_idx" ON public."DocumentAsset" USING btree ("methodAttemptId");


--
-- Name: DocumentAsset_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentAsset_tenantId_idx" ON public."DocumentAsset" USING btree ("tenantId");


--
-- Name: Invitation_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invitation_email_idx" ON public."Invitation" USING btree (email);


--
-- Name: Invitation_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invitation_expiresAt_idx" ON public."Invitation" USING btree ("expiresAt");


--
-- Name: Invitation_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invitation_status_idx" ON public."Invitation" USING btree (status);


--
-- Name: Invitation_username_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invitation_username_idx" ON public."Invitation" USING btree (username);


--
-- Name: InvoiceLine_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceLine_invoiceId_idx" ON public."InvoiceLine" USING btree ("invoiceId");


--
-- Name: InvoiceLine_tenantId_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceLine_tenantId_serviceId_idx" ON public."InvoiceLine" USING btree ("tenantId", "serviceId");


--
-- Name: Invoice_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invoice_number_key" ON public."Invoice" USING btree (number);


--
-- Name: Invoice_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_tenantId_status_idx" ON public."Invoice" USING btree ("tenantId", status);


--
-- Name: LedgerAccount_scopeKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LedgerAccount_scopeKey_key" ON public."LedgerAccount" USING btree ("scopeKey");


--
-- Name: LedgerAccount_tenantId_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerAccount_tenantId_kind_idx" ON public."LedgerAccount" USING btree ("tenantId", kind);


--
-- Name: LedgerEntry_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_accountId_idx" ON public."LedgerEntry" USING btree ("accountId");


--
-- Name: LedgerEntry_transactionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_transactionId_idx" ON public."LedgerEntry" USING btree ("transactionId");


--
-- Name: LedgerTransaction_refType_refId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerTransaction_refType_refId_idx" ON public."LedgerTransaction" USING btree ("refType", "refId");


--
-- Name: LedgerTransaction_tenantId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerTransaction_tenantId_occurredAt_idx" ON public."LedgerTransaction" USING btree ("tenantId", "occurredAt");


--
-- Name: OAuthClient_clientId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON public."OAuthClient" USING btree ("clientId");


--
-- Name: OAuthClient_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OAuthClient_tenantId_idx" ON public."OAuthClient" USING btree ("tenantId");


--
-- Name: OAuthLoginRequest_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OAuthLoginRequest_clientId_idx" ON public."OAuthLoginRequest" USING btree ("clientId");


--
-- Name: OAuthLoginRequest_codeHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "OAuthLoginRequest_codeHash_key" ON public."OAuthLoginRequest" USING btree ("codeHash");


--
-- Name: OAuthLoginRequest_pollTokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "OAuthLoginRequest_pollTokenHash_key" ON public."OAuthLoginRequest" USING btree ("pollTokenHash");


--
-- Name: OAuthLoginRequest_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OAuthLoginRequest_tenantId_idx" ON public."OAuthLoginRequest" USING btree ("tenantId");


--
-- Name: Offer_profileId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offer_profileId_idx" ON public."Offer" USING btree ("profileId");


--
-- Name: OrganizationBeneficialOwner_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrganizationBeneficialOwner_tenantId_idx" ON public."OrganizationBeneficialOwner" USING btree ("tenantId");


--
-- Name: OrganizationMembership_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrganizationMembership_accountId_idx" ON public."OrganizationMembership" USING btree ("accountId");


--
-- Name: OrganizationMembership_personSubjectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrganizationMembership_personSubjectId_idx" ON public."OrganizationMembership" USING btree ("personSubjectId");


--
-- Name: OrganizationMembership_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrganizationMembership_tenantId_idx" ON public."OrganizationMembership" USING btree ("tenantId");


--
-- Name: Organization_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Organization_tenantId_idx" ON public."Organization" USING btree ("tenantId");


--
-- Name: OutboundEvent_status_nextAttemptAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutboundEvent_status_nextAttemptAt_idx" ON public."OutboundEvent" USING btree (status, "nextAttemptAt");


--
-- Name: OutboundEvent_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutboundEvent_tenantId_status_idx" ON public."OutboundEvent" USING btree ("tenantId", status);


--
-- Name: PaymentIntent_provider_providerRef_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentIntent_provider_providerRef_key" ON public."PaymentIntent" USING btree (provider, "providerRef");


--
-- Name: PaymentIntent_tenantId_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentIntent_tenantId_idempotencyKey_key" ON public."PaymentIntent" USING btree ("tenantId", "idempotencyKey");


--
-- Name: PaymentIntent_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentIntent_tenantId_status_idx" ON public."PaymentIntent" USING btree ("tenantId", status);


--
-- Name: Payment_provider_providerTransactionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Payment_provider_providerTransactionId_key" ON public."Payment" USING btree (provider, "providerTransactionId");


--
-- Name: Payment_tenantId_paidAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_tenantId_paidAt_idx" ON public."Payment" USING btree ("tenantId", "paidAt");


--
-- Name: PermissionCatalog_groupName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PermissionCatalog_groupName_idx" ON public."PermissionCatalog" USING btree ("groupName");


--
-- Name: PermissionCatalog_groupName_serviceName_permissionKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PermissionCatalog_groupName_serviceName_permissionKey_key" ON public."PermissionCatalog" USING btree ("groupName", "serviceName", "permissionKey");


--
-- Name: PermissionCatalog_permissionKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PermissionCatalog_permissionKey_idx" ON public."PermissionCatalog" USING btree ("permissionKey");


--
-- Name: PermissionCatalog_serviceName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PermissionCatalog_serviceName_idx" ON public."PermissionCatalog" USING btree ("serviceName");


--
-- Name: PhoneBadgeEvidence_phone_claimType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PhoneBadgeEvidence_phone_claimType_idx" ON public."PhoneBadgeEvidence" USING btree (phone, "claimType");


--
-- Name: PhoneNameEvidence_phone_verifiedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PhoneNameEvidence_phone_verifiedAt_idx" ON public."PhoneNameEvidence" USING btree (phone, "verifiedAt");


--
-- Name: Plan_serviceId_key_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Plan_serviceId_key_version_key" ON public."Plan" USING btree ("serviceId", key, version);


--
-- Name: Plan_serviceId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Plan_serviceId_status_idx" ON public."Plan" USING btree ("serviceId", status);


--
-- Name: ProfileFieldGrant_granteeAccountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProfileFieldGrant_granteeAccountId_idx" ON public."ProfileFieldGrant" USING btree ("granteeAccountId");


--
-- Name: ProfileFieldGrant_granteeOrganizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProfileFieldGrant_granteeOrganizationId_idx" ON public."ProfileFieldGrant" USING btree ("granteeOrganizationId");


--
-- Name: ProfileFieldGrant_profileId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProfileFieldGrant_profileId_idx" ON public."ProfileFieldGrant" USING btree ("profileId");


--
-- Name: ProfileImage_profileId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProfileImage_profileId_idx" ON public."ProfileImage" USING btree ("profileId");


--
-- Name: Profile_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Profile_accountId_idx" ON public."Profile" USING btree ("accountId");


--
-- Name: Profile_accountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Profile_accountId_key" ON public."Profile" USING btree ("accountId");


--
-- Name: Profile_organizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Profile_organizationId_idx" ON public."Profile" USING btree ("organizationId");


--
-- Name: Profile_organizationId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Profile_organizationId_key" ON public."Profile" USING btree ("organizationId");


--
-- Name: Profile_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Profile_slug_key" ON public."Profile" USING btree (slug);


--
-- Name: Refund_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Refund_tenantId_status_idx" ON public."Refund" USING btree ("tenantId", status);


--
-- Name: RoleAssignment_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RoleAssignment_accountId_idx" ON public."RoleAssignment" USING btree ("accountId");


--
-- Name: RoleAssignment_accountId_roleDefinitionId_scope_organizatio_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RoleAssignment_accountId_roleDefinitionId_scope_organizatio_key" ON public."RoleAssignment" USING btree ("accountId", "roleDefinitionId", scope, "organizationId", "brandId");


--
-- Name: RoleAssignment_roleDefinitionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RoleAssignment_roleDefinitionId_idx" ON public."RoleAssignment" USING btree ("roleDefinitionId");


--
-- Name: RoleAssignment_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RoleAssignment_tenantId_idx" ON public."RoleAssignment" USING btree ("tenantId");


--
-- Name: RoleDefinition_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RoleDefinition_tenantId_idx" ON public."RoleDefinition" USING btree ("tenantId");


--
-- Name: RoleDefinition_tenantId_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RoleDefinition_tenantId_slug_key" ON public."RoleDefinition" USING btree ("tenantId", slug);


--
-- Name: Service_profileId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_profileId_idx" ON public."Service" USING btree ("profileId");


--
-- Name: SettlementRecord_provider_providerSettlementId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SettlementRecord_provider_providerSettlementId_key" ON public."SettlementRecord" USING btree (provider, "providerSettlementId");


--
-- Name: SettlementRecord_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SettlementRecord_status_idx" ON public."SettlementRecord" USING btree (status);


--
-- Name: SocialLink_profileId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SocialLink_profileId_idx" ON public."SocialLink" USING btree ("profileId");


--
-- Name: Subject_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subject_accountId_idx" ON public."Subject" USING btree ("accountId");


--
-- Name: Subject_tenantId_externalRef_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subject_tenantId_externalRef_idx" ON public."Subject" USING btree ("tenantId", "externalRef");


--
-- Name: Subject_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subject_tenantId_idx" ON public."Subject" USING btree ("tenantId");


--
-- Name: Subscription_tenantId_currentPeriodEnd_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_tenantId_currentPeriodEnd_idx" ON public."Subscription" USING btree ("tenantId", "currentPeriodEnd");


--
-- Name: Subscription_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_tenantId_status_idx" ON public."Subscription" USING btree ("tenantId", status);


--
-- Name: TenantApiKey_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TenantApiKey_tenantId_idx" ON public."TenantApiKey" USING btree ("tenantId");


--
-- Name: TenantStaffMembership_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TenantStaffMembership_accountId_idx" ON public."TenantStaffMembership" USING btree ("accountId");


--
-- Name: UsageRecord_serviceId_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UsageRecord_serviceId_idempotencyKey_key" ON public."UsageRecord" USING btree ("serviceId", "idempotencyKey");


--
-- Name: UsageRecord_tenantId_serviceId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UsageRecord_tenantId_serviceId_occurredAt_idx" ON public."UsageRecord" USING btree ("tenantId", "serviceId", "occurredAt");


--
-- Name: VerificationCase_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerificationCase_tenantId_idx" ON public."VerificationCase" USING btree ("tenantId");


--
-- Name: VerificationCase_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerificationCase_tenantId_status_idx" ON public."VerificationCase" USING btree ("tenantId", status);


--
-- Name: VerificationCase_tenantId_subjectId_claimType_status_level_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerificationCase_tenantId_subjectId_claimType_status_level_idx" ON public."VerificationCase" USING btree ("tenantId", "subjectId", "claimType", status, level);


--
-- Name: VerificationMethodAttempt_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerificationMethodAttempt_caseId_idx" ON public."VerificationMethodAttempt" USING btree ("caseId");


--
-- Name: VerificationMethodAttempt_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerificationMethodAttempt_tenantId_idx" ON public."VerificationMethodAttempt" USING btree ("tenantId");


--
-- Name: VerificationPolicy_tenantId_claimType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerificationPolicy_tenantId_claimType_idx" ON public."VerificationPolicy" USING btree ("tenantId", "claimType");


--
-- Name: VerificationPolicy_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerificationPolicy_tenantId_idx" ON public."VerificationPolicy" USING btree ("tenantId");


--
-- Name: VerificationSession_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerificationSession_caseId_idx" ON public."VerificationSession" USING btree ("caseId");


--
-- Name: VerificationSession_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerificationSession_tenantId_idx" ON public."VerificationSession" USING btree ("tenantId");


--
-- Name: VerifiedAttribute_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerifiedAttribute_tenantId_idx" ON public."VerifiedAttribute" USING btree ("tenantId");


--
-- Name: VerifiedAttribute_tenantId_subjectId_attribute_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerifiedAttribute_tenantId_subjectId_attribute_idx" ON public."VerifiedAttribute" USING btree ("tenantId", "subjectId", attribute);


--
-- Name: WebhookEvent_provider_providerEventId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WebhookEvent_provider_providerEventId_key" ON public."WebhookEvent" USING btree (provider, "providerEventId");


--
-- Name: WebhookEvent_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WebhookEvent_tenantId_status_idx" ON public."WebhookEvent" USING btree ("tenantId", status);


--
-- Name: access_grant tg_access_grant_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_access_grant_del INSTEAD OF DELETE ON public.access_grant FOR EACH ROW EXECUTE FUNCTION public.tg_access_grant_del();


--
-- Name: access_grant tg_access_grant_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_access_grant_ins INSTEAD OF INSERT ON public.access_grant FOR EACH ROW EXECUTE FUNCTION public.tg_access_grant_ins();


--
-- Name: access_grant tg_access_grant_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_access_grant_upd INSTEAD OF UPDATE ON public.access_grant FOR EACH ROW EXECUTE FUNCTION public.tg_access_grant_upd();


--
-- Name: appointment tg_appointment_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_appointment_del INSTEAD OF DELETE ON public.appointment FOR EACH ROW EXECUTE FUNCTION public.tg_appointment_del();


--
-- Name: appointment tg_appointment_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_appointment_ins INSTEAD OF INSERT ON public.appointment FOR EACH ROW EXECUTE FUNCTION public.tg_appointment_ins();


--
-- Name: appointment tg_appointment_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_appointment_upd INSTEAD OF UPDATE ON public.appointment FOR EACH ROW EXECUTE FUNCTION public.tg_appointment_upd();


--
-- Name: audit_log_entry tg_audit_log_entry_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_audit_log_entry_del INSTEAD OF DELETE ON public.audit_log_entry FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log_entry_del();


--
-- Name: audit_log_entry tg_audit_log_entry_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_audit_log_entry_ins INSTEAD OF INSERT ON public.audit_log_entry FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log_entry_ins();


--
-- Name: audit_log_entry tg_audit_log_entry_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_audit_log_entry_upd INSTEAD OF UPDATE ON public.audit_log_entry FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log_entry_upd();


--
-- Name: availability_rule tg_availability_rule_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_availability_rule_del INSTEAD OF DELETE ON public.availability_rule FOR EACH ROW EXECUTE FUNCTION public.tg_availability_rule_del();


--
-- Name: availability_rule tg_availability_rule_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_availability_rule_ins INSTEAD OF INSERT ON public.availability_rule FOR EACH ROW EXECUTE FUNCTION public.tg_availability_rule_ins();


--
-- Name: availability_rule tg_availability_rule_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_availability_rule_upd INSTEAD OF UPDATE ON public.availability_rule FOR EACH ROW EXECUTE FUNCTION public.tg_availability_rule_upd();


--
-- Name: billing_account tg_billing_account_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_billing_account_del INSTEAD OF DELETE ON public.billing_account FOR EACH ROW EXECUTE FUNCTION public.tg_billing_account_del();


--
-- Name: billing_account tg_billing_account_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_billing_account_ins INSTEAD OF INSERT ON public.billing_account FOR EACH ROW EXECUTE FUNCTION public.tg_billing_account_ins();


--
-- Name: billing_account tg_billing_account_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_billing_account_upd INSTEAD OF UPDATE ON public.billing_account FOR EACH ROW EXECUTE FUNCTION public.tg_billing_account_upd();


--
-- Name: billing_service tg_billing_service_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_billing_service_del INSTEAD OF DELETE ON public.billing_service FOR EACH ROW EXECUTE FUNCTION public.tg_billing_service_del();


--
-- Name: billing_service tg_billing_service_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_billing_service_ins INSTEAD OF INSERT ON public.billing_service FOR EACH ROW EXECUTE FUNCTION public.tg_billing_service_ins();


--
-- Name: billing_service tg_billing_service_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_billing_service_upd INSTEAD OF UPDATE ON public.billing_service FOR EACH ROW EXECUTE FUNCTION public.tg_billing_service_upd();


--
-- Name: business_hour tg_business_hour_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_business_hour_del INSTEAD OF DELETE ON public.business_hour FOR EACH ROW EXECUTE FUNCTION public.tg_business_hour_del();


--
-- Name: business_hour tg_business_hour_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_business_hour_ins INSTEAD OF INSERT ON public.business_hour FOR EACH ROW EXECUTE FUNCTION public.tg_business_hour_ins();


--
-- Name: business_hour tg_business_hour_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_business_hour_upd INSTEAD OF UPDATE ON public.business_hour FOR EACH ROW EXECUTE FUNCTION public.tg_business_hour_upd();


--
-- Name: checkout_session tg_checkout_session_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_checkout_session_del INSTEAD OF DELETE ON public.checkout_session FOR EACH ROW EXECUTE FUNCTION public.tg_checkout_session_del();


--
-- Name: checkout_session tg_checkout_session_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_checkout_session_ins INSTEAD OF INSERT ON public.checkout_session FOR EACH ROW EXECUTE FUNCTION public.tg_checkout_session_ins();


--
-- Name: checkout_session tg_checkout_session_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_checkout_session_upd INSTEAD OF UPDATE ON public.checkout_session FOR EACH ROW EXECUTE FUNCTION public.tg_checkout_session_upd();


--
-- Name: credit_ledger_entry tg_credit_ledger_entry_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_credit_ledger_entry_del INSTEAD OF DELETE ON public.credit_ledger_entry FOR EACH ROW EXECUTE FUNCTION public.tg_credit_ledger_entry_del();


--
-- Name: credit_ledger_entry tg_credit_ledger_entry_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_credit_ledger_entry_ins INSTEAD OF INSERT ON public.credit_ledger_entry FOR EACH ROW EXECUTE FUNCTION public.tg_credit_ledger_entry_ins();


--
-- Name: credit_ledger_entry tg_credit_ledger_entry_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_credit_ledger_entry_upd INSTEAD OF UPDATE ON public.credit_ledger_entry FOR EACH ROW EXECUTE FUNCTION public.tg_credit_ledger_entry_upd();


--
-- Name: department_assignment tg_department_assignment_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_department_assignment_del INSTEAD OF DELETE ON public.department_assignment FOR EACH ROW EXECUTE FUNCTION public.tg_department_assignment_del();


--
-- Name: department_assignment tg_department_assignment_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_department_assignment_ins INSTEAD OF INSERT ON public.department_assignment FOR EACH ROW EXECUTE FUNCTION public.tg_department_assignment_ins();


--
-- Name: department_assignment tg_department_assignment_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_department_assignment_upd INSTEAD OF UPDATE ON public.department_assignment FOR EACH ROW EXECUTE FUNCTION public.tg_department_assignment_upd();


--
-- Name: invitation tg_invitation_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_invitation_del INSTEAD OF DELETE ON public.invitation FOR EACH ROW EXECUTE FUNCTION public.tg_invitation_del();


--
-- Name: invitation tg_invitation_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_invitation_ins INSTEAD OF INSERT ON public.invitation FOR EACH ROW EXECUTE FUNCTION public.tg_invitation_ins();


--
-- Name: invitation tg_invitation_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_invitation_upd INSTEAD OF UPDATE ON public.invitation FOR EACH ROW EXECUTE FUNCTION public.tg_invitation_upd();


--
-- Name: invoice tg_invoice_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_invoice_del INSTEAD OF DELETE ON public.invoice FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_del();


--
-- Name: invoice tg_invoice_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_invoice_ins INSTEAD OF INSERT ON public.invoice FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_ins();


--
-- Name: invoice tg_invoice_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_invoice_upd INSTEAD OF UPDATE ON public.invoice FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_upd();


--
-- Name: ledger_account tg_ledger_account_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_ledger_account_del INSTEAD OF DELETE ON public.ledger_account FOR EACH ROW EXECUTE FUNCTION public.tg_ledger_account_del();


--
-- Name: ledger_account tg_ledger_account_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_ledger_account_ins INSTEAD OF INSERT ON public.ledger_account FOR EACH ROW EXECUTE FUNCTION public.tg_ledger_account_ins();


--
-- Name: ledger_account tg_ledger_account_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_ledger_account_upd INSTEAD OF UPDATE ON public.ledger_account FOR EACH ROW EXECUTE FUNCTION public.tg_ledger_account_upd();


--
-- Name: ledger_entry tg_ledger_entry_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_ledger_entry_del INSTEAD OF DELETE ON public.ledger_entry FOR EACH ROW EXECUTE FUNCTION public.tg_ledger_entry_del();


--
-- Name: ledger_entry tg_ledger_entry_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_ledger_entry_ins INSTEAD OF INSERT ON public.ledger_entry FOR EACH ROW EXECUTE FUNCTION public.tg_ledger_entry_ins();


--
-- Name: ledger_entry tg_ledger_entry_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_ledger_entry_upd INSTEAD OF UPDATE ON public.ledger_entry FOR EACH ROW EXECUTE FUNCTION public.tg_ledger_entry_upd();


--
-- Name: ledger_transaction tg_ledger_transaction_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_ledger_transaction_del INSTEAD OF DELETE ON public.ledger_transaction FOR EACH ROW EXECUTE FUNCTION public.tg_ledger_transaction_del();


--
-- Name: ledger_transaction tg_ledger_transaction_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_ledger_transaction_ins INSTEAD OF INSERT ON public.ledger_transaction FOR EACH ROW EXECUTE FUNCTION public.tg_ledger_transaction_ins();


--
-- Name: ledger_transaction tg_ledger_transaction_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_ledger_transaction_upd INSTEAD OF UPDATE ON public.ledger_transaction FOR EACH ROW EXECUTE FUNCTION public.tg_ledger_transaction_upd();


--
-- Name: oauth_login_request tg_oauth_login_request_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_oauth_login_request_del INSTEAD OF DELETE ON public.oauth_login_request FOR EACH ROW EXECUTE FUNCTION public.tg_oauth_login_request_del();


--
-- Name: oauth_login_request tg_oauth_login_request_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_oauth_login_request_ins INSTEAD OF INSERT ON public.oauth_login_request FOR EACH ROW EXECUTE FUNCTION public.tg_oauth_login_request_ins();


--
-- Name: oauth_login_request tg_oauth_login_request_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_oauth_login_request_upd INSTEAD OF UPDATE ON public.oauth_login_request FOR EACH ROW EXECUTE FUNCTION public.tg_oauth_login_request_upd();


--
-- Name: organization_membership tg_organization_membership_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_organization_membership_del INSTEAD OF DELETE ON public.organization_membership FOR EACH ROW EXECUTE FUNCTION public.tg_organization_membership_del();


--
-- Name: organization_membership tg_organization_membership_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_organization_membership_ins INSTEAD OF INSERT ON public.organization_membership FOR EACH ROW EXECUTE FUNCTION public.tg_organization_membership_ins();


--
-- Name: organization_membership tg_organization_membership_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_organization_membership_upd INSTEAD OF UPDATE ON public.organization_membership FOR EACH ROW EXECUTE FUNCTION public.tg_organization_membership_upd();


--
-- Name: outbound_event tg_outbound_event_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_outbound_event_del INSTEAD OF DELETE ON public.outbound_event FOR EACH ROW EXECUTE FUNCTION public.tg_outbound_event_del();


--
-- Name: outbound_event tg_outbound_event_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_outbound_event_ins INSTEAD OF INSERT ON public.outbound_event FOR EACH ROW EXECUTE FUNCTION public.tg_outbound_event_ins();


--
-- Name: outbound_event tg_outbound_event_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_outbound_event_upd INSTEAD OF UPDATE ON public.outbound_event FOR EACH ROW EXECUTE FUNCTION public.tg_outbound_event_upd();


--
-- Name: payment tg_payment_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_payment_del INSTEAD OF DELETE ON public.payment FOR EACH ROW EXECUTE FUNCTION public.tg_payment_del();


--
-- Name: payment tg_payment_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_payment_ins INSTEAD OF INSERT ON public.payment FOR EACH ROW EXECUTE FUNCTION public.tg_payment_ins();


--
-- Name: payment_intent tg_payment_intent_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_payment_intent_del INSTEAD OF DELETE ON public.payment_intent FOR EACH ROW EXECUTE FUNCTION public.tg_payment_intent_del();


--
-- Name: payment_intent tg_payment_intent_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_payment_intent_ins INSTEAD OF INSERT ON public.payment_intent FOR EACH ROW EXECUTE FUNCTION public.tg_payment_intent_ins();


--
-- Name: payment_intent tg_payment_intent_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_payment_intent_upd INSTEAD OF UPDATE ON public.payment_intent FOR EACH ROW EXECUTE FUNCTION public.tg_payment_intent_upd();


--
-- Name: payment tg_payment_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_payment_upd INSTEAD OF UPDATE ON public.payment FOR EACH ROW EXECUTE FUNCTION public.tg_payment_upd();


--
-- Name: phone_badge_evidence tg_phone_badge_evidence_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_phone_badge_evidence_del INSTEAD OF DELETE ON public.phone_badge_evidence FOR EACH ROW EXECUTE FUNCTION public.tg_phone_badge_evidence_del();


--
-- Name: phone_badge_evidence tg_phone_badge_evidence_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_phone_badge_evidence_ins INSTEAD OF INSERT ON public.phone_badge_evidence FOR EACH ROW EXECUTE FUNCTION public.tg_phone_badge_evidence_ins();


--
-- Name: phone_badge_evidence tg_phone_badge_evidence_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_phone_badge_evidence_upd INSTEAD OF UPDATE ON public.phone_badge_evidence FOR EACH ROW EXECUTE FUNCTION public.tg_phone_badge_evidence_upd();


--
-- Name: plan tg_plan_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_plan_del INSTEAD OF DELETE ON public.plan FOR EACH ROW EXECUTE FUNCTION public.tg_plan_del();


--
-- Name: plan tg_plan_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_plan_ins INSTEAD OF INSERT ON public.plan FOR EACH ROW EXECUTE FUNCTION public.tg_plan_ins();


--
-- Name: plan tg_plan_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_plan_upd INSTEAD OF UPDATE ON public.plan FOR EACH ROW EXECUTE FUNCTION public.tg_plan_upd();


--
-- Name: profile tg_profile_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_profile_del INSTEAD OF DELETE ON public.profile FOR EACH ROW EXECUTE FUNCTION public.tg_profile_del();


--
-- Name: profile_field_grant tg_profile_field_grant_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_profile_field_grant_del INSTEAD OF DELETE ON public.profile_field_grant FOR EACH ROW EXECUTE FUNCTION public.tg_profile_field_grant_del();


--
-- Name: profile_field_grant tg_profile_field_grant_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_profile_field_grant_ins INSTEAD OF INSERT ON public.profile_field_grant FOR EACH ROW EXECUTE FUNCTION public.tg_profile_field_grant_ins();


--
-- Name: profile_field_grant tg_profile_field_grant_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_profile_field_grant_upd INSTEAD OF UPDATE ON public.profile_field_grant FOR EACH ROW EXECUTE FUNCTION public.tg_profile_field_grant_upd();


--
-- Name: profile_image tg_profile_image_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_profile_image_del INSTEAD OF DELETE ON public.profile_image FOR EACH ROW EXECUTE FUNCTION public.tg_profile_image_del();


--
-- Name: profile_image tg_profile_image_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_profile_image_ins INSTEAD OF INSERT ON public.profile_image FOR EACH ROW EXECUTE FUNCTION public.tg_profile_image_ins();


--
-- Name: profile_image tg_profile_image_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_profile_image_upd INSTEAD OF UPDATE ON public.profile_image FOR EACH ROW EXECUTE FUNCTION public.tg_profile_image_upd();


--
-- Name: profile tg_profile_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_profile_ins INSTEAD OF INSERT ON public.profile FOR EACH ROW EXECUTE FUNCTION public.tg_profile_ins();


--
-- Name: profile tg_profile_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_profile_upd INSTEAD OF UPDATE ON public.profile FOR EACH ROW EXECUTE FUNCTION public.tg_profile_upd();


--
-- Name: refund tg_refund_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_refund_del INSTEAD OF DELETE ON public.refund FOR EACH ROW EXECUTE FUNCTION public.tg_refund_del();


--
-- Name: refund tg_refund_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_refund_ins INSTEAD OF INSERT ON public.refund FOR EACH ROW EXECUTE FUNCTION public.tg_refund_ins();


--
-- Name: refund tg_refund_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_refund_upd INSTEAD OF UPDATE ON public.refund FOR EACH ROW EXECUTE FUNCTION public.tg_refund_upd();


--
-- Name: role_assignment tg_role_assignment_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_role_assignment_del INSTEAD OF DELETE ON public.role_assignment FOR EACH ROW EXECUTE FUNCTION public.tg_role_assignment_del();


--
-- Name: role_assignment tg_role_assignment_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_role_assignment_ins INSTEAD OF INSERT ON public.role_assignment FOR EACH ROW EXECUTE FUNCTION public.tg_role_assignment_ins();


--
-- Name: role_assignment tg_role_assignment_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_role_assignment_upd INSTEAD OF UPDATE ON public.role_assignment FOR EACH ROW EXECUTE FUNCTION public.tg_role_assignment_upd();


--
-- Name: settlement_record tg_settlement_record_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_settlement_record_del INSTEAD OF DELETE ON public.settlement_record FOR EACH ROW EXECUTE FUNCTION public.tg_settlement_record_del();


--
-- Name: settlement_record tg_settlement_record_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_settlement_record_ins INSTEAD OF INSERT ON public.settlement_record FOR EACH ROW EXECUTE FUNCTION public.tg_settlement_record_ins();


--
-- Name: settlement_record tg_settlement_record_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_settlement_record_upd INSTEAD OF UPDATE ON public.settlement_record FOR EACH ROW EXECUTE FUNCTION public.tg_settlement_record_upd();


--
-- Name: social_link tg_social_link_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_social_link_del INSTEAD OF DELETE ON public.social_link FOR EACH ROW EXECUTE FUNCTION public.tg_social_link_del();


--
-- Name: social_link tg_social_link_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_social_link_ins INSTEAD OF INSERT ON public.social_link FOR EACH ROW EXECUTE FUNCTION public.tg_social_link_ins();


--
-- Name: social_link tg_social_link_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_social_link_upd INSTEAD OF UPDATE ON public.social_link FOR EACH ROW EXECUTE FUNCTION public.tg_social_link_upd();


--
-- Name: subject tg_subject_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_subject_del INSTEAD OF DELETE ON public.subject FOR EACH ROW EXECUTE FUNCTION public.tg_subject_del();


--
-- Name: subject tg_subject_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_subject_ins INSTEAD OF INSERT ON public.subject FOR EACH ROW EXECUTE FUNCTION public.tg_subject_ins();


--
-- Name: subject tg_subject_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_subject_upd INSTEAD OF UPDATE ON public.subject FOR EACH ROW EXECUTE FUNCTION public.tg_subject_upd();


--
-- Name: subscription tg_subscription_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_subscription_del INSTEAD OF DELETE ON public.subscription FOR EACH ROW EXECUTE FUNCTION public.tg_subscription_del();


--
-- Name: subscription tg_subscription_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_subscription_ins INSTEAD OF INSERT ON public.subscription FOR EACH ROW EXECUTE FUNCTION public.tg_subscription_ins();


--
-- Name: subscription tg_subscription_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_subscription_upd INSTEAD OF UPDATE ON public.subscription FOR EACH ROW EXECUTE FUNCTION public.tg_subscription_upd();


--
-- Name: verification_case tg_verification_case_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_verification_case_del INSTEAD OF DELETE ON public.verification_case FOR EACH ROW EXECUTE FUNCTION public.tg_verification_case_del();


--
-- Name: verification_case tg_verification_case_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_verification_case_ins INSTEAD OF INSERT ON public.verification_case FOR EACH ROW EXECUTE FUNCTION public.tg_verification_case_ins();


--
-- Name: verification_case tg_verification_case_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_verification_case_upd INSTEAD OF UPDATE ON public.verification_case FOR EACH ROW EXECUTE FUNCTION public.tg_verification_case_upd();


--
-- Name: verification_method_attempt tg_verification_method_attempt_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_verification_method_attempt_del INSTEAD OF DELETE ON public.verification_method_attempt FOR EACH ROW EXECUTE FUNCTION public.tg_verification_method_attempt_del();


--
-- Name: verification_method_attempt tg_verification_method_attempt_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_verification_method_attempt_ins INSTEAD OF INSERT ON public.verification_method_attempt FOR EACH ROW EXECUTE FUNCTION public.tg_verification_method_attempt_ins();


--
-- Name: verification_method_attempt tg_verification_method_attempt_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_verification_method_attempt_upd INSTEAD OF UPDATE ON public.verification_method_attempt FOR EACH ROW EXECUTE FUNCTION public.tg_verification_method_attempt_upd();


--
-- Name: verification_policy tg_verification_policy_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_verification_policy_del INSTEAD OF DELETE ON public.verification_policy FOR EACH ROW EXECUTE FUNCTION public.tg_verification_policy_del();


--
-- Name: verification_policy tg_verification_policy_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_verification_policy_ins INSTEAD OF INSERT ON public.verification_policy FOR EACH ROW EXECUTE FUNCTION public.tg_verification_policy_ins();


--
-- Name: verification_policy tg_verification_policy_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_verification_policy_upd INSTEAD OF UPDATE ON public.verification_policy FOR EACH ROW EXECUTE FUNCTION public.tg_verification_policy_upd();


--
-- Name: verified_attribute tg_verified_attribute_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_verified_attribute_del INSTEAD OF DELETE ON public.verified_attribute FOR EACH ROW EXECUTE FUNCTION public.tg_verified_attribute_del();


--
-- Name: verified_attribute tg_verified_attribute_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_verified_attribute_ins INSTEAD OF INSERT ON public.verified_attribute FOR EACH ROW EXECUTE FUNCTION public.tg_verified_attribute_ins();


--
-- Name: verified_attribute tg_verified_attribute_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_verified_attribute_upd INSTEAD OF UPDATE ON public.verified_attribute FOR EACH ROW EXECUTE FUNCTION public.tg_verified_attribute_upd();


--
-- Name: webhook_event tg_webhook_event_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_webhook_event_del INSTEAD OF DELETE ON public.webhook_event FOR EACH ROW EXECUTE FUNCTION public.tg_webhook_event_del();


--
-- Name: webhook_event tg_webhook_event_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_webhook_event_ins INSTEAD OF INSERT ON public.webhook_event FOR EACH ROW EXECUTE FUNCTION public.tg_webhook_event_ins();


--
-- Name: webhook_event tg_webhook_event_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_webhook_event_upd INSTEAD OF UPDATE ON public.webhook_event FOR EACH ROW EXECUTE FUNCTION public.tg_webhook_event_upd();


--
-- Name: AccessGrant AccessGrant_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccessGrant"
    ADD CONSTRAINT "AccessGrant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AccessGrant AccessGrant_brandId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccessGrant"
    ADD CONSTRAINT "AccessGrant_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES public."Brand"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AccessGrant AccessGrant_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccessGrant"
    ADD CONSTRAINT "AccessGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AccessGrant AccessGrant_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccessGrant"
    ADD CONSTRAINT "AccessGrant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AccountEmailOtpCode AccountEmailOtpCode_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccountEmailOtpCode"
    ADD CONSTRAINT "AccountEmailOtpCode_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AccountSession AccountSession_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccountSession"
    ADD CONSTRAINT "AccountSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Appointment Appointment_profileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public."Profile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Appointment Appointment_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AuditLogEntry AuditLogEntry_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLogEntry"
    ADD CONSTRAINT "AuditLogEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AvailabilityRule AvailabilityRule_profileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AvailabilityRule"
    ADD CONSTRAINT "AvailabilityRule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public."Profile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BillingAccount BillingAccount_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BillingAccount"
    ADD CONSTRAINT "BillingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BillingServiceCredential BillingServiceCredential_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BillingServiceCredential"
    ADD CONSTRAINT "BillingServiceCredential_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."BillingService"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Brand Brand_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Brand"
    ADD CONSTRAINT "Brand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BusinessHour BusinessHour_profileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessHour"
    ADD CONSTRAINT "BusinessHour_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public."Profile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CheckoutSession CheckoutSession_paymentIntentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CheckoutSession"
    ADD CONSTRAINT "CheckoutSession_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES public."PaymentIntent"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CheckoutSession CheckoutSession_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CheckoutSession"
    ADD CONSTRAINT "CheckoutSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ContactMessage ContactMessage_profileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContactMessage"
    ADD CONSTRAINT "ContactMessage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public."Profile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CreditLedgerEntry CreditLedgerEntry_billingAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreditLedgerEntry"
    ADD CONSTRAINT "CreditLedgerEntry_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES public."BillingAccount"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CreditLedgerEntry CreditLedgerEntry_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreditLedgerEntry"
    ADD CONSTRAINT "CreditLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CustomLink CustomLink_profileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomLink"
    ADD CONSTRAINT "CustomLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public."Profile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DepartmentAssignment DepartmentAssignment_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DepartmentAssignment"
    ADD CONSTRAINT "DepartmentAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DepartmentAssignment DepartmentAssignment_brandId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DepartmentAssignment"
    ADD CONSTRAINT "DepartmentAssignment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES public."Brand"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DepartmentAssignment DepartmentAssignment_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DepartmentAssignment"
    ADD CONSTRAINT "DepartmentAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DepartmentAssignment DepartmentAssignment_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DepartmentAssignment"
    ADD CONSTRAINT "DepartmentAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DepartmentAssignment DepartmentAssignment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DepartmentAssignment"
    ADD CONSTRAINT "DepartmentAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Department Department_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DocumentAsset DocumentAsset_methodAttemptId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentAsset"
    ADD CONSTRAINT "DocumentAsset_methodAttemptId_fkey" FOREIGN KEY ("methodAttemptId") REFERENCES public."VerificationMethodAttempt"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invitation Invitation_brandId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES public."Brand"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invitation Invitation_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invitation Invitation_invitedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invitation Invitation_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invitation Invitation_roleDefinitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_roleDefinitionId_fkey" FOREIGN KEY ("roleDefinitionId") REFERENCES public."RoleDefinition"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invitation Invitation_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLine InvoiceLine_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLine InvoiceLine_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."BillingService"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InvoiceLine InvoiceLine_subscriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES public."Subscription"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InvoiceLine InvoiceLine_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_billingAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES public."BillingAccount"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LedgerAccount LedgerAccount_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerAccount"
    ADD CONSTRAINT "LedgerAccount_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."BillingService"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LedgerAccount LedgerAccount_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerAccount"
    ADD CONSTRAINT "LedgerAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LedgerEntry LedgerEntry_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."LedgerAccount"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LedgerEntry LedgerEntry_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LedgerEntry LedgerEntry_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public."LedgerTransaction"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LedgerTransaction LedgerTransaction_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerTransaction"
    ADD CONSTRAINT "LedgerTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OAuthClient OAuthClient_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OAuthClient"
    ADD CONSTRAINT "OAuthClient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OAuthLoginRequest OAuthLoginRequest_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OAuthLoginRequest"
    ADD CONSTRAINT "OAuthLoginRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OAuthLoginRequest OAuthLoginRequest_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OAuthLoginRequest"
    ADD CONSTRAINT "OAuthLoginRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."OAuthClient"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Offer Offer_profileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offer"
    ADD CONSTRAINT "Offer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public."Profile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrganizationBeneficialOwner OrganizationBeneficialOwner_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrganizationBeneficialOwner"
    ADD CONSTRAINT "OrganizationBeneficialOwner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrganizationMembership OrganizationMembership_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrganizationMembership"
    ADD CONSTRAINT "OrganizationMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OrganizationMembership OrganizationMembership_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrganizationMembership"
    ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Organization Organization_subjectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES public."Subject"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Organization Organization_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OutboundEvent OutboundEvent_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OutboundEvent"
    ADD CONSTRAINT "OutboundEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."BillingService"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OutboundEvent OutboundEvent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OutboundEvent"
    ADD CONSTRAINT "OutboundEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PaymentIntent PaymentIntent_billingAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentIntent"
    ADD CONSTRAINT "PaymentIntent_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES public."BillingAccount"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PaymentIntent PaymentIntent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentIntent"
    ADD CONSTRAINT "PaymentIntent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_paymentIntentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES public."PaymentIntent"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Plan Plan_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Plan"
    ADD CONSTRAINT "Plan_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."BillingService"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProfileFieldGrant ProfileFieldGrant_granteeAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProfileFieldGrant"
    ADD CONSTRAINT "ProfileFieldGrant_granteeAccountId_fkey" FOREIGN KEY ("granteeAccountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProfileFieldGrant ProfileFieldGrant_granteeOrganizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProfileFieldGrant"
    ADD CONSTRAINT "ProfileFieldGrant_granteeOrganizationId_fkey" FOREIGN KEY ("granteeOrganizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProfileFieldGrant ProfileFieldGrant_profileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProfileFieldGrant"
    ADD CONSTRAINT "ProfileFieldGrant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public."Profile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProfileImage ProfileImage_profileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProfileImage"
    ADD CONSTRAINT "ProfileImage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public."Profile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Profile Profile_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Profile"
    ADD CONSTRAINT "Profile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Profile Profile_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Profile"
    ADD CONSTRAINT "Profile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Refund Refund_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Refund"
    ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public."Payment"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Refund Refund_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Refund"
    ADD CONSTRAINT "Refund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RoleAssignment RoleAssignment_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoleAssignment"
    ADD CONSTRAINT "RoleAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RoleAssignment RoleAssignment_brandId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoleAssignment"
    ADD CONSTRAINT "RoleAssignment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES public."Brand"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RoleAssignment RoleAssignment_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoleAssignment"
    ADD CONSTRAINT "RoleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RoleAssignment RoleAssignment_roleDefinitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoleAssignment"
    ADD CONSTRAINT "RoleAssignment_roleDefinitionId_fkey" FOREIGN KEY ("roleDefinitionId") REFERENCES public."RoleDefinition"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RoleAssignment RoleAssignment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoleAssignment"
    ADD CONSTRAINT "RoleAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RoleDefinition RoleDefinition_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoleDefinition"
    ADD CONSTRAINT "RoleDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Service Service_profileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public."Profile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SocialLink SocialLink_profileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SocialLink"
    ADD CONSTRAINT "SocialLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public."Profile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Subject Subject_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subject"
    ADD CONSTRAINT "Subject_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Subject Subject_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subject"
    ADD CONSTRAINT "Subject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Subscription Subscription_billingAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES public."BillingAccount"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Subscription Subscription_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."Plan"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Subscription Subscription_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TenantApiKey TenantApiKey_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantApiKey"
    ADD CONSTRAINT "TenantApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TenantStaffMembership TenantStaffMembership_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantStaffMembership"
    ADD CONSTRAINT "TenantStaffMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TenantStaffMembership TenantStaffMembership_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantStaffMembership"
    ADD CONSTRAINT "TenantStaffMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UsageRecord UsageRecord_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsageRecord"
    ADD CONSTRAINT "UsageRecord_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."BillingService"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UsageRecord UsageRecord_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsageRecord"
    ADD CONSTRAINT "UsageRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: VerificationCase VerificationCase_policyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationCase"
    ADD CONSTRAINT "VerificationCase_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES public."VerificationPolicy"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VerificationCase VerificationCase_subjectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationCase"
    ADD CONSTRAINT "VerificationCase_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES public."Subject"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: VerificationCase VerificationCase_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationCase"
    ADD CONSTRAINT "VerificationCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: VerificationMethodAttempt VerificationMethodAttempt_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationMethodAttempt"
    ADD CONSTRAINT "VerificationMethodAttempt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public."VerificationCase"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: VerificationPolicy VerificationPolicy_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationPolicy"
    ADD CONSTRAINT "VerificationPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: VerificationSession VerificationSession_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationSession"
    ADD CONSTRAINT "VerificationSession_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public."VerificationCase"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: VerificationSession VerificationSession_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationSession"
    ADD CONSTRAINT "VerificationSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: VerifiedAttribute VerifiedAttribute_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerifiedAttribute"
    ADD CONSTRAINT "VerifiedAttribute_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public."VerificationCase"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: VerifiedAttribute VerifiedAttribute_subjectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerifiedAttribute"
    ADD CONSTRAINT "VerifiedAttribute_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES public."Subject"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WebhookEvent WebhookEvent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WebhookEvent"
    ADD CONSTRAINT "WebhookEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLogEntry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."AuditLogEntry" ENABLE ROW LEVEL SECURITY;

--
-- Name: BillingAccount; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."BillingAccount" ENABLE ROW LEVEL SECURITY;

--
-- Name: BillingService; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."BillingService" ENABLE ROW LEVEL SECURITY;

--
-- Name: BillingServiceCredential; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."BillingServiceCredential" ENABLE ROW LEVEL SECURITY;

--
-- Name: CheckoutSession; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."CheckoutSession" ENABLE ROW LEVEL SECURITY;

--
-- Name: CreditLedgerEntry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."CreditLedgerEntry" ENABLE ROW LEVEL SECURITY;

--
-- Name: DocumentAsset; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."DocumentAsset" ENABLE ROW LEVEL SECURITY;

--
-- Name: Invoice; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Invoice" ENABLE ROW LEVEL SECURITY;

--
-- Name: InvoiceLine; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."InvoiceLine" ENABLE ROW LEVEL SECURITY;

--
-- Name: LedgerAccount; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."LedgerAccount" ENABLE ROW LEVEL SECURITY;

--
-- Name: LedgerEntry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."LedgerEntry" ENABLE ROW LEVEL SECURITY;

--
-- Name: LedgerTransaction; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."LedgerTransaction" ENABLE ROW LEVEL SECURITY;

--
-- Name: OAuthClient; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."OAuthClient" ENABLE ROW LEVEL SECURITY;

--
-- Name: OAuthLoginRequest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."OAuthLoginRequest" ENABLE ROW LEVEL SECURITY;

--
-- Name: Organization; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;

--
-- Name: OrganizationBeneficialOwner; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."OrganizationBeneficialOwner" ENABLE ROW LEVEL SECURITY;

--
-- Name: OrganizationMembership; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."OrganizationMembership" ENABLE ROW LEVEL SECURITY;

--
-- Name: OutboundEvent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."OutboundEvent" ENABLE ROW LEVEL SECURITY;

--
-- Name: Payment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;

--
-- Name: PaymentIntent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PaymentIntent" ENABLE ROW LEVEL SECURITY;

--
-- Name: Plan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Plan" ENABLE ROW LEVEL SECURITY;

--
-- Name: Refund; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Refund" ENABLE ROW LEVEL SECURITY;

--
-- Name: SettlementRecord; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."SettlementRecord" ENABLE ROW LEVEL SECURITY;

--
-- Name: Subject; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Subject" ENABLE ROW LEVEL SECURITY;

--
-- Name: Subscription; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;

--
-- Name: Tenant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Tenant" ENABLE ROW LEVEL SECURITY;

--
-- Name: TenantApiKey; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."TenantApiKey" ENABLE ROW LEVEL SECURITY;

--
-- Name: TenantStaffMembership; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."TenantStaffMembership" ENABLE ROW LEVEL SECURITY;

--
-- Name: UsageRecord; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UsageRecord" ENABLE ROW LEVEL SECURITY;

--
-- Name: VerificationCase; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."VerificationCase" ENABLE ROW LEVEL SECURITY;

--
-- Name: VerificationMethodAttempt; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."VerificationMethodAttempt" ENABLE ROW LEVEL SECURITY;

--
-- Name: VerificationPolicy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."VerificationPolicy" ENABLE ROW LEVEL SECURITY;

--
-- Name: VerificationSession; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."VerificationSession" ENABLE ROW LEVEL SECURITY;

--
-- Name: VerifiedAttribute; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."VerifiedAttribute" ENABLE ROW LEVEL SECURITY;

--
-- Name: WebhookEvent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."WebhookEvent" ENABLE ROW LEVEL SECURITY;

--
-- Name: TenantApiKey api_key_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_key_delete_scoped ON public."TenantApiKey" FOR DELETE USING (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: TenantApiKey api_key_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_key_insert_scoped ON public."TenantApiKey" FOR INSERT WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: TenantApiKey api_key_lookup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_key_lookup ON public."TenantApiKey" FOR SELECT USING (true);


--
-- Name: TenantApiKey api_key_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_key_update_scoped ON public."TenantApiKey" FOR UPDATE USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: BillingService catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_read ON public."BillingService" FOR SELECT USING (true);


--
-- Name: BillingServiceCredential catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_read ON public."BillingServiceCredential" FOR SELECT USING (true);


--
-- Name: Plan catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_read ON public."Plan" FOR SELECT USING (true);


--
-- Name: BillingService catalog_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_write ON public."BillingService" USING ((current_setting('app.billing_admin'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.billing_admin'::text, true) = 'on'::text));


--
-- Name: BillingServiceCredential catalog_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_write ON public."BillingServiceCredential" USING ((current_setting('app.billing_admin'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.billing_admin'::text, true) = 'on'::text));


--
-- Name: Plan catalog_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_write ON public."Plan" USING ((current_setting('app.billing_admin'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.billing_admin'::text, true) = 'on'::text));


--
-- Name: CheckoutSession checkout_session_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkout_session_delete_scoped ON public."CheckoutSession" FOR DELETE USING (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: CheckoutSession checkout_session_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkout_session_insert_scoped ON public."CheckoutSession" FOR INSERT WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: CheckoutSession checkout_session_lookup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkout_session_lookup ON public."CheckoutSession" FOR SELECT USING (true);


--
-- Name: CheckoutSession checkout_session_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkout_session_update_scoped ON public."CheckoutSession" FOR UPDATE USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: OAuthLoginRequest login_request_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY login_request_delete_scoped ON public."OAuthLoginRequest" FOR DELETE USING (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: OAuthLoginRequest login_request_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY login_request_insert_scoped ON public."OAuthLoginRequest" FOR INSERT WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: OAuthLoginRequest login_request_lookup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY login_request_lookup ON public."OAuthLoginRequest" FOR SELECT USING (true);


--
-- Name: OAuthLoginRequest login_request_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY login_request_update_scoped ON public."OAuthLoginRequest" FOR UPDATE USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: OAuthClient oauth_client_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY oauth_client_delete_scoped ON public."OAuthClient" FOR DELETE USING (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: OAuthClient oauth_client_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY oauth_client_insert_scoped ON public."OAuthClient" FOR INSERT WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: OAuthClient oauth_client_lookup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY oauth_client_lookup ON public."OAuthClient" FOR SELECT USING (true);


--
-- Name: OAuthClient oauth_client_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY oauth_client_update_scoped ON public."OAuthClient" FOR UPDATE USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: Organization organization_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_delete_scoped ON public."Organization" FOR DELETE USING (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: Organization organization_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_insert_scoped ON public."Organization" FOR INSERT WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: Organization organization_lookup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_lookup ON public."Organization" FOR SELECT USING (true);


--
-- Name: OrganizationMembership organization_membership_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_membership_delete_scoped ON public."OrganizationMembership" FOR DELETE USING (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: OrganizationMembership organization_membership_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_membership_insert_scoped ON public."OrganizationMembership" FOR INSERT WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: OrganizationMembership organization_membership_lookup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_membership_lookup ON public."OrganizationMembership" FOR SELECT USING (true);


--
-- Name: OrganizationMembership organization_membership_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_membership_update_scoped ON public."OrganizationMembership" FOR UPDATE USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: Organization organization_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_update_scoped ON public."Organization" FOR UPDATE USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: PaymentIntent payment_intent_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_intent_delete_scoped ON public."PaymentIntent" FOR DELETE USING (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: PaymentIntent payment_intent_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_intent_insert_scoped ON public."PaymentIntent" FOR INSERT WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: PaymentIntent payment_intent_lookup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_intent_lookup ON public."PaymentIntent" FOR SELECT USING (true);


--
-- Name: PaymentIntent payment_intent_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_intent_update_scoped ON public."PaymentIntent" FOR UPDATE USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: VerificationSession session_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_delete_scoped ON public."VerificationSession" FOR DELETE USING (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: VerificationSession session_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_insert_scoped ON public."VerificationSession" FOR INSERT WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: VerificationSession session_lookup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_lookup ON public."VerificationSession" FOR SELECT USING (true);


--
-- Name: VerificationSession session_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_update_scoped ON public."VerificationSession" FOR UPDATE USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: SettlementRecord settlement_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settlement_admin_only ON public."SettlementRecord" USING ((current_setting('app.billing_admin'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.billing_admin'::text, true) = 'on'::text));


--
-- Name: AuditLogEntry tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."AuditLogEntry" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: BillingAccount tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."BillingAccount" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: CreditLedgerEntry tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."CreditLedgerEntry" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: DocumentAsset tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."DocumentAsset" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: Invoice tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."Invoice" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: InvoiceLine tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."InvoiceLine" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: LedgerAccount tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."LedgerAccount" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: LedgerEntry tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."LedgerEntry" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: LedgerTransaction tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."LedgerTransaction" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: OrganizationBeneficialOwner tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."OrganizationBeneficialOwner" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: OutboundEvent tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."OutboundEvent" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: Payment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."Payment" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: Refund tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."Refund" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: Subject tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."Subject" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: Subscription tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."Subscription" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: UsageRecord tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."UsageRecord" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: VerificationCase tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."VerificationCase" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: VerificationMethodAttempt tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."VerificationMethodAttempt" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: VerificationPolicy tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."VerificationPolicy" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: VerifiedAttribute tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public."VerifiedAttribute" USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: Tenant tenant_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_self ON public."Tenant" USING ((id = current_setting('app.tenant_id'::text, true))) WITH CHECK ((id = current_setting('app.tenant_id'::text, true)));


--
-- Name: TenantStaffMembership tenant_staff_membership_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_staff_membership_delete_scoped ON public."TenantStaffMembership" FOR DELETE USING (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: TenantStaffMembership tenant_staff_membership_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_staff_membership_insert_scoped ON public."TenantStaffMembership" FOR INSERT WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: TenantStaffMembership tenant_staff_membership_lookup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_staff_membership_lookup ON public."TenantStaffMembership" FOR SELECT USING (true);


--
-- Name: TenantStaffMembership tenant_staff_membership_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_staff_membership_update_scoped ON public."TenantStaffMembership" FOR UPDATE USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: WebhookEvent webhook_event_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY webhook_event_delete_scoped ON public."WebhookEvent" FOR DELETE USING (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: WebhookEvent webhook_event_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY webhook_event_insert_scoped ON public."WebhookEvent" FOR INSERT WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- Name: WebhookEvent webhook_event_lookup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY webhook_event_lookup ON public."WebhookEvent" FOR SELECT USING (true);


--
-- Name: WebhookEvent webhook_event_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY webhook_event_update_scoped ON public."WebhookEvent" FOR UPDATE USING (("tenantId" = current_setting('app.tenant_id'::text, true))) WITH CHECK (("tenantId" = current_setting('app.tenant_id'::text, true)));


--
-- PostgreSQL database dump complete
--


