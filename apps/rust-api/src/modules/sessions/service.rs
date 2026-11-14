//! Sessions service.

use anyhow::{anyhow, Result};
use deadpool_postgres::Object;
use nid_shared_types::sha256_hex;
use sqlx::{FromRow, Row};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::sessions::dto::SessionStatusResponse;

pub struct SessionsService {
    db: DbPool,
    env: AppEnv,
}

impl SessionsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    /// Look up a verification session by token and return the case status
    pub async fn get_status(&self, token: &str) -> Result<SessionStatusResponse> {
        let conn = self.db.get().await?;
        let token_hash = sha256_hex(token);

        // Find the session by token hash
        let session: (String, String, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
            "SELECT tenant_id, case_id, expires_at FROM verification_session WHERE token_hash = $1",
        )
        .bind(&token_hash)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Invalid session token"))?;

        let tenant_id = session.0;
        let case_id = session.1;
        let expires_at = session.2;

        // Check expiration
        if chrono::Utc::now() > expires_at {
            return Err(anyhow!("Session token has expired"));
        }

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1").bind(&tenant_id).execute(&mut *conn).await?;

        // Get the case status
        let case: (String, String, String, Option<chrono::DateTime<chrono::Utc>>) = sqlx::query_as(
            "SELECT status, level, claim_type, resolved_at FROM verification_case WHERE id = $1",
        )
        .bind(&case_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Verification case not found"))?;

        Ok(SessionStatusResponse {
            case_id,
            status: case.0,
            level: case.1,
            claim_type: case.2,
            resolved_at: case.3.map(|d| d.to_rfc3339()),
        })
    }
}
