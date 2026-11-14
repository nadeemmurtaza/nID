-- Additive, nullable: apps/api's own AuditService never sets this column.
ALTER TABLE "AuditLogEntry" ADD COLUMN "metadata" JSONB;
