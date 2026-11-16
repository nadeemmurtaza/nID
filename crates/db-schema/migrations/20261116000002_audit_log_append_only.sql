-- The audit log must not be editable by the role that serves requests
-- (SECURITY_RULES.md item 20). 20261115000001 granted nid_app blanket
-- UPDATE/DELETE on every table, including this one.
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLogEntry" FROM nid_app;
