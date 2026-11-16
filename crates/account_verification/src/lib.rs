//! Account verification — business logic for self-verification.
//!
//! Extracted from `apps/rust-api/src/modules/account_verification/service.rs`.
//! Plain `sqlx::PgPool` instead of `core::db::DbPool` -- every query here
//! stands alone, no transaction spanning multiple statements.

use anyhow::{anyhow, Result};
use serde::Serialize;
use sqlx::{PgPool, Row};

#[derive(Debug, Clone, Serialize)]
pub struct BadgeEntry {
    pub claim_type: String,
    pub level: String,
    pub verified_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct VerificationStatusResponse {
    pub account_id: String,
    pub badges: Vec<BadgeEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct VerificationCaseResponse {
    pub id: String,
    pub subject_id: String,
    pub claim_type: String,
    pub level: String,
    pub status: String,
    pub created_at: String,
    pub resolved_at: Option<String>,
}

pub struct AccountVerificationService {
    db: PgPool,
}

impl AccountVerificationService {
    /// Open a transaction with RLS context settings applied. They are
    /// transaction-local (`set_config(.., true)`), so they must be set on the
    /// transaction itself and are gone once it ends.
    async fn scoped(&self, settings: &[(&str, &str)]) -> Result<sqlx::Transaction<'_, sqlx::Postgres>> {
        let mut tx = self.db.begin().await?;
        for (k, v) in settings {
            sqlx::query("SELECT set_config($1, $2, true)")
                .bind(*k)
                .bind(*v)
                .execute(&mut *tx)
                .await?;
        }
        Ok(tx)
    }

    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn get_status(&self, account_id: &str) -> Result<VerificationStatusResponse> {
        // Get the account's phone
        let phone = sqlx::query("SELECT phone FROM account WHERE id = $1")
            .bind(account_id)
            .fetch_optional(&self.db)
            .await?
            .and_then(|r| r.get::<Option<String>, _>("phone"));

        if phone.is_none() {
            return Ok(VerificationStatusResponse {
                account_id: account_id.to_string(),
                badges: Vec::new(),
            });
        }
        let phone = phone.unwrap();

        // Get badges from phone_badge_evidence (strongest per claim_type)
        let rows = sqlx::query(
            "SELECT claim_type, level, verified_at FROM phone_badge_evidence WHERE phone = $1 ORDER BY level DESC, verified_at DESC",
        )
        .bind(&phone)
        .fetch_all(&self.db)
        .await?;

        let mut seen = std::collections::HashSet::new();
        let badges: Vec<BadgeEntry> = rows
            .into_iter()
            .filter(|r| seen.insert(r.get::<String, _>("claim_type").clone()))
            .map(|r| BadgeEntry {
                claim_type: r.get("claim_type"),
                level: r.get("level"),
                verified_at: r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("verified_at")
                    .map(|d| d.to_rfc3339()),
            })
            .collect();

        Ok(VerificationStatusResponse {
            account_id: account_id.to_string(),
            badges,
        })
    }

    /// Self-service case creation is not available yet. A case needs a
    /// verification policy (which methods run, at what level) and nothing
    /// defines one for a person verifying themselves outside a tenant; the
    /// TypeScript Verification Center this replaces is read-only. Failing
    /// plainly beats the previous behaviour of inserting under a tenant id
    /// that never existed and surfacing a foreign key error.
    pub async fn create_case(
        &self,
        _account_id: &str,
        _claim_type: &str,
        _level: Option<&str>,
    ) -> Result<VerificationCaseResponse> {
        Err(anyhow!("Self-service verification cases are not available yet"))
    }

    pub async fn list_cases(&self, account_id: &str) -> Result<Vec<VerificationCaseResponse>> {
        let mut conn = self.scoped(&[("app.account_id", account_id)]).await?;
        let subject_id = sqlx::query(
            "SELECT id FROM subject WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"));

        if subject_id.is_none() {
            return Ok(Vec::new());
        }
        let subject_id = subject_id.unwrap();

        let rows = sqlx::query(
            "SELECT id, subject_id, claim_type, level, status, created_at, resolved_at FROM verification_case WHERE subject_id = $1 ORDER BY created_at DESC",
        )
        .bind(&subject_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| VerificationCaseResponse {
            id: r.get("id"),
            subject_id: r.get("subject_id"),
            claim_type: r.get("claim_type"),
            level: r.get("level"),
            status: r.get("status"),
            created_at: r.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            resolved_at: r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("resolved_at")
                .map(|d| d.to_rfc3339()),
        }).collect())
    }

    pub async fn get_case(&self, account_id: &str, case_id: &str) -> Result<VerificationCaseResponse> {
        let mut conn = self.scoped(&[("app.account_id", account_id)]).await?;
        let subject_id = sqlx::query(
            "SELECT id FROM subject WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"));

        if subject_id.is_none() {
            return Err(anyhow!("No subject found for this account"));
        }
        let subject_id = subject_id.unwrap();

        let row = sqlx::query(
            "SELECT id, subject_id, claim_type, level, status, created_at, resolved_at FROM verification_case WHERE id = $1 AND subject_id = $2",
        )
        .bind(case_id)
        .bind(&subject_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Case not found"))?;

        Ok(VerificationCaseResponse {
            id: row.get("id"),
            subject_id: row.get("subject_id"),
            claim_type: row.get("claim_type"),
            level: row.get("level"),
            status: row.get("status"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            resolved_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("resolved_at")
                .map(|d| d.to_rfc3339()),
        })
    }
}
