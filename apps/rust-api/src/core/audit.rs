//! Audit logging service for recording all significant actions.
//!
//! Mirrors the NestJS audit.service.ts in apps/api/src/core/audit/.
//! Every write operation (create, update, delete) is recorded in the
//! audit_log_entry table with actor information and metadata.

use anyhow::{Context, Result};
use sqlx::Row;
use uuid::Uuid;

use crate::core::db::DbPool;

/// The type of actor performing an action.
#[derive(Debug, Clone)]
pub enum AuditActorType {
    Account,
    ApiKey,
    System,
}

impl std::fmt::Display for AuditActorType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuditActorType::Account => write!(f, "ACCOUNT"),
            AuditActorType::ApiKey => write!(f, "API_KEY"),
            AuditActorType::System => write!(f, "SYSTEM"),
        }
    }
}

/// An audit log entry.
#[derive(Debug, Clone)]
pub struct AuditEntry {
    pub tenant_id: String,
    pub actor_type: AuditActorType,
    pub actor_id: String,
    pub action: String,
    pub metadata: Option<serde_json::Value>,
}

/// Audit logging service.
pub struct AuditService {
    db: DbPool,
}

impl AuditService {
    pub fn new(db: DbPool) -> Self {
        Self { db }
    }

    /// Record an audit log entry.
    ///
    /// This is the main entry point for recording actions. It inserts a row
    /// into the audit_log_entry table with the current timestamp and a new UUID.
    pub async fn record(&self, entry: &AuditEntry) -> Result<Uuid> {
        let mut conn = self.db.inner().begin().await?;

        // Set tenant context for RLS
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
            .bind(&entry.tenant_id)
            .execute(&mut *conn)
            .await?;

        let id = Uuid::new_v4();
        let metadata = entry
            .metadata
            .as_ref()
            .and_then(|v| match v {
                serde_json::Value::Null => None,
                _ => Some(entry.metadata.as_ref().unwrap()),
            });

        let row_id: String = sqlx::query_scalar(
            r#"INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, metadata)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id"#,
        )
        .bind(id.to_string())
        .bind(&entry.tenant_id)
        .bind(entry.actor_type.to_string())
        .bind(&entry.actor_id)
        .bind(&entry.action)
        .bind(metadata.cloned().map(sqlx::types::Json))
        .fetch_one(&mut *conn)
        .await
        .context("Failed to insert audit log entry")?;

        tracing::debug!(
            audit_id = %row_id,
            tenant_id = %entry.tenant_id,
            actor_type = %entry.actor_type,
            actor_id = %entry.actor_id,
            action = %entry.action,
            "Audit log entry recorded"
        );

        conn.commit().await?;
        Ok(Uuid::parse_str(&row_id).unwrap_or(id))
    }

    /// Record a quick audit entry without metadata.
    pub async fn record_simple(
        &self,
        tenant_id: &str,
        actor_type: AuditActorType,
        actor_id: &str,
        action: &str,
    ) -> Result<Uuid> {
        self.record(&AuditEntry {
            tenant_id: tenant_id.to_string(),
            actor_type,
            actor_id: actor_id.to_string(),
            action: action.to_string(),
            metadata: None,
        })
        .await
    }

    /// Query recent audit log entries for a tenant.
    pub async fn list_recent(
        &self,
        tenant_id: &str,
        limit: usize,
    ) -> Result<Vec<serde_json::Value>> {
        let mut conn = self.db.inner().begin().await?;

        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        let rows = sqlx::query(
            r#"SELECT id, tenant_id, actor_type, actor_id, action, metadata, created_at
               FROM audit_log_entry
               WHERE tenant_id = $1
               ORDER BY created_at DESC
               LIMIT $2"#,
        )
        .bind(tenant_id)
        .bind(limit as i64)
        .fetch_all(&mut *conn)
        .await
        .context("Failed to query audit log entries")?;

        let entries: Vec<serde_json::Value> = rows
            .into_iter()
            .map(|row| {
                serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "tenant_id": row.get::<String, _>("tenant_id"),
                    "actor_type": row.get::<String, _>("actor_type"),
                    "actor_id": row.get::<String, _>("actor_id"),
                    "action": row.get::<String, _>("action"),
                    "metadata": row.get::<Option<String>, _>("metadata").and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                    "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
                })
            })
            .collect();

        conn.commit().await?;
        Ok(entries)
    }
}

/// Record a privileged action (SECURITY_RULES.md item 20) after it succeeded.
///
/// The action has already committed by the time this runs, so a failure to
/// write the audit row is logged loudly rather than turned into an error the
/// caller would retry. Entries are append-only for the request-serving role
/// (UPDATE/DELETE revoked on the table).
pub async fn log_admin_action(
    db: &DbPool,
    tenant_id: &str,
    actor_type: AuditActorType,
    actor_id: &str,
    action: &str,
    metadata: serde_json::Value,
) {
    let entry = AuditEntry {
        tenant_id: tenant_id.to_string(),
        actor_type,
        actor_id: actor_id.to_string(),
        action: action.to_string(),
        metadata: Some(metadata),
    };
    if let Err(e) = AuditService::new(db.clone()).record(&entry).await {
        tracing::error!(error = %format!("{e:#}"), action, tenant_id, "FAILED to write audit log entry");
    }
}
