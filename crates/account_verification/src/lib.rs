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

    /// Start a self-service verification case for the signed-in account.
    ///
    /// Filed under the platform tenant `self`; the policy is chosen from that
    /// tenant's policy rows by claim type and, if given, level (otherwise the
    /// lowest level on offer). The case is created PENDING; running the
    /// policy's methods is the verification workflow's job.
    pub async fn create_case(
        &self,
        account_id: &str,
        claim_type: &str,
        level: Option<&str>,
    ) -> Result<VerificationCaseResponse> {
        // 'self' is a platform-owned tenant, so this system flow asserts its
        // own context (plus the caller's, for the account-owned records).
        let mut conn = self
            .scoped(&[("app.tenant_id", "self"), ("app.account_id", account_id)])
            .await?;

        let policy: Option<(String, String, String)> = sqlx::query_as(
            r#"
            SELECT id, claim_type, level FROM verification_policy
            WHERE tenant_id = 'self' AND claim_type = $1
              AND ($2::text IS NULL OR level = $2)
            ORDER BY CASE level WHEN 'SELF_ATTESTED' THEN 0 WHEN 'DOCUMENT_VERIFIED' THEN 1 ELSE 2 END
            LIMIT 1
            "#,
        )
        .bind(claim_type)
        .bind(level)
        .fetch_optional(&mut *conn)
        .await?;
        let (policy_id, claim_type, level) = policy.ok_or_else(|| {
            anyhow!("Invalid: no self-service verification is offered for that claim type and level")
        })?;

        let subject_id: String = match sqlx::query_scalar(
            "SELECT id FROM subject WHERE account_id = $1 AND tenant_id = 'self' LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        {
            Some(id) => id,
            None => sqlx::query_scalar(
                "INSERT INTO subject (id, tenant_id, type, account_id) VALUES (gen_random_uuid(), 'self', 'PERSON', $1) RETURNING id",
            )
            .bind(account_id)
            .fetch_one(&mut *conn)
            .await?,
        };

        let case_id: String = sqlx::query_scalar(
            r#"
            INSERT INTO verification_case (id, tenant_id, subject_id, policy_id, claim_type, level, status)
            VALUES (gen_random_uuid(), 'self', $1, $2, $3, $4, 'PENDING')
            RETURNING id
            "#,
        )
        .bind(&subject_id)
        .bind(&policy_id)
        .bind(&claim_type)
        .bind(&level)
        .fetch_one(&mut *conn)
        .await?;

        conn.commit().await?;
        Ok(VerificationCaseResponse {
            id: case_id,
            subject_id,
            claim_type,
            level,
            status: "PENDING".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            resolved_at: None,
        })
    }

    pub async fn list_cases(&self, account_id: &str) -> Result<Vec<VerificationCaseResponse>> {
        let mut conn = self.scoped(&[("app.account_id", account_id)]).await?;
        let rows = sqlx::query(
            "SELECT id, subject_id, claim_type, level, status, created_at, resolved_at FROM verification_case WHERE subject_id IN (SELECT id FROM subject WHERE account_id = $1) ORDER BY created_at DESC",
        )
        .bind(account_id)
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
        let row = sqlx::query(
            "SELECT id, subject_id, claim_type, level, status, created_at, resolved_at FROM verification_case WHERE id = $1 AND subject_id IN (SELECT id FROM subject WHERE account_id = $2)",
        )
        .bind(case_id)
        .bind(account_id)
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
