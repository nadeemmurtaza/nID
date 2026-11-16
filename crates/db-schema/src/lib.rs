//! SQLx-native schema migrations for nID's Postgres database.
//!
//! Replaces `packages/db/prisma/migrations` (Prisma) as the source of
//! truth for schema changes going forward — see CONVENTIONS.md's
//! "Decided, migration tracked" section. The first migration here is a
//! `pg_dump --schema-only` snapshot of the schema as Prisma's migrations
//! had already built it, so this is a cutover point, not a rewrite: no
//! table, column, or RLS policy changed, only the tool that owns them.
//!
//! `apps/workflows`, `packages/verification-providers`, and
//! `packages/billing` still read/write this same database through the
//! Prisma client directly (not through `apps/rust-api`), so
//! `packages/db/prisma` stays in the repo — and schema changes must be
//! applied to both migration sets in lockstep — until those three
//! services are themselves ported off Prisma. That port is a separate,
//! much larger piece of work, tracked but not started.

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

/// Encrypt any webhook secrets still stored as plaintext, then clear them.
///
/// Run before [`MIGRATOR`]: migration 20261116000007 drops the plaintext
/// columns and refuses to run while any value remains in them. A no-op on a
/// fresh database and on one that is already migrated. Needs the superuser
/// connection (it reads and writes `"Tenant"` across all tenants) and
/// `WEBHOOK_SECRET_KEY` when there is anything to encrypt.
pub async fn encrypt_legacy_webhook_secrets(
    pool: &sqlx::PgPool,
    secrets: &nid_shared_types::SecretBox,
) -> Result<usize, sqlx::Error> {
    let has_plaintext: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'Tenant'
                          AND column_name = 'webhookSecretPlaintext')",
    )
    .fetch_one(pool)
    .await?;
    if !has_plaintext {
        return Ok(0);
    }

    sqlx::query(r#"ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "webhookSecretEnc" text"#).execute(pool).await?;
    sqlx::query(r#"ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "billingWebhookSecretEnc" text"#).execute(pool).await?;

    let rows: Vec<(String, Option<String>, Option<String>)> = sqlx::query_as(
        r#"-- validate-sql: skip (legacy column, dropped by migration 20261116000007)
        SELECT id, "webhookSecretPlaintext", "billingWebhookSecretPlaintext" FROM "Tenant"
           WHERE "webhookSecretPlaintext" IS NOT NULL OR "billingWebhookSecretPlaintext" IS NOT NULL"#,
    )
    .fetch_all(pool)
    .await?;

    for (id, webhook, billing) in &rows {
        sqlx::query(
            r#"-- validate-sql: skip (legacy column, dropped by migration 20261116000007)
            UPDATE "Tenant" SET
                 "webhookSecretEnc" = COALESCE($2, "webhookSecretEnc"),
                 "billingWebhookSecretEnc" = COALESCE($3, "billingWebhookSecretEnc"),
                 "webhookSecretPlaintext" = NULL, "billingWebhookSecretPlaintext" = NULL
               WHERE id = $1"#,
        )
        .bind(id)
        .bind(webhook.as_ref().map(|v| secrets.encrypt(&format!("tenant:{id}:webhook"), v)))
        .bind(billing.as_ref().map(|v| secrets.encrypt(&format!("tenant:{id}:billing"), v)))
        .execute(pool)
        .await?;
    }
    Ok(rows.len())
}
