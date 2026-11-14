//! Account verification service — business logic for self-verification.

use anyhow::{anyhow, Result};
use sqlx::{FromRow, Row};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::account_verification::dto::{
    BadgeEntry, VerificationCaseResponse, VerificationStatusResponse,
};

pub struct AccountVerificationService {
    db: DbPool,
    env: AppEnv,
}

impl AccountVerificationService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn get_status(&self, account_id: &str) -> Result<VerificationStatusResponse> {
        let mut conn = self.db.get().await?;

        // Get the account's phone
        let phone = sqlx::query("SELECT phone FROM account WHERE id = $1")
            .bind(account_id)
            .fetch_optional(&mut *conn)
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
        .fetch_all(&mut *conn)
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

    pub async fn create_case(
        &self,
        account_id: &str,
        req: &crate::modules::account_verification::dto::CreateSelfVerificationCaseRequest,
    ) -> Result<VerificationCaseResponse> {
        let mut conn = self.db.get().await?;

        // Find or create subject for this account
        let subject_id = sqlx::query(
            "SELECT id FROM subject WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"));

        let subject_id = match subject_id {
            Some(id) => id,
            None => {
                let row = sqlx::query(
                    "INSERT INTO subject (id, tenant_id, type, account_id) VALUES (gen_random_uuid(), 'self', 'PERSON', $1) RETURNING id",
                )
                .bind(account_id)
                .fetch_one(&mut *conn)
                .await?;
                row.get("id")
            }
        };

        let level = req.level.as_deref().unwrap_or("SELF_ATTESTED");

        let case_id: String = sqlx::query(
            r#"
            INSERT INTO verification_case (id, tenant_id, subject_id, claim_type, level, status)
            VALUES (gen_random_uuid(), 'self', $1, $2, $3, 'PENDING')
            RETURNING id
            "#,
        )
        .bind(&subject_id)
        .bind(&req.claim_type)
        .bind(level)
        .fetch_one(&mut *conn)
        .await?
        .get("id");

        Ok(VerificationCaseResponse {
            id: case_id,
            subject_id,
            claim_type: req.claim_type.clone(),
            level: level.to_string(),
            status: "PENDING".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            resolved_at: None,
        })
    }

    pub async fn list_cases(&self, account_id: &str) -> Result<Vec<VerificationCaseResponse>> {
        let mut conn = self.db.get().await?;

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
        let mut conn = self.db.get().await?;

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
