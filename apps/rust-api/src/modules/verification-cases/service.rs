//! Verification Cases service — business logic for verification case operations.
//!
//! Mirrors `apps/api/src/modules/verification-cases/verification-cases.service.ts`.
//! Note: Temporal workflow integration is deferred — cases are created without
//! starting a Temporal workflow. The TypeScript backend starts the workflow
//! after the DB transaction commits; the Rust version will do the same once
//! Temporal Rust SDK is integrated.

use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use deadpool_postgres::Object;
use nid_shared_types::{generate_session_token, sha256_hex};
use sqlx::{FromRow, Row};
use tracing::info;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::verification_cases::dto::{
    CreatedCaseResponse, MessageResponse, MethodAttemptResponse, SubjectSummary,
    VerificationCaseResponse, VerificationCaseWithAttempts, VerificationCaseWithSubject,
};

/// Verification case row from database
#[derive(Debug, Clone, FromRow)]
pub struct VerificationCaseRow {
    pub id: String,
    pub tenant_id: String,
    pub subject_id: String,
    pub policy_id: String,
    pub status: String,
    pub temporal_workflow_id: Option<String>,
    pub decision: Option<String>,
    pub reviewer_id: Option<String>,
    pub claim_type: String,
    pub level: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub resolved_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Verification policy row
#[derive(Debug, Clone, FromRow)]
pub struct VerificationPolicyRow {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub methods: Vec<String>,
    pub claim_type: String,
    pub level: String,
}

/// Method attempt row
#[derive(Debug, Clone, FromRow)]
pub struct MethodAttemptRow {
    pub id: String,
    pub tenant_id: String,
    pub case_id: String,
    pub method: String,
    pub status: String,
    pub provider_key: String,
    pub result_meta: Option<serde_json::Value>,
    pub score: Option<f64>,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Subject summary row
#[derive(Debug, Clone, FromRow)]
pub struct SubjectSummaryRow {
    pub id: String,
    pub given_name: Option<String>,
    pub family_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
}

/// Verification Cases service
pub struct VerificationCasesService {
    db: DbPool,
    env: AppEnv,
}

impl VerificationCasesService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    /// Convert case row to response
    fn case_to_response(row: VerificationCaseRow) -> VerificationCaseResponse {
        VerificationCaseResponse {
            id: row.id,
            tenant_id: row.tenant_id,
            subject_id: row.subject_id,
            policy_id: row.policy_id,
            status: row.status,
            temporal_workflow_id: row.temporal_workflow_id,
            decision: row.decision,
            reviewer_id: row.reviewer_id,
            claim_type: row.claim_type,
            level: row.level,
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
            resolved_at: row.resolved_at.map(|d| d.to_rfc3339()),
        }
    }

    /// Convert subject summary row to response
    fn subject_to_summary(row: SubjectSummaryRow) -> SubjectSummary {
        SubjectSummary {
            id: row.id,
            given_name: row.given_name,
            family_name: row.family_name,
            email: row.email,
            phone: row.phone,
        }
    }

    /// Convert method attempt row to response
    fn attempt_to_response(row: MethodAttemptRow) -> MethodAttemptResponse {
        MethodAttemptResponse {
            id: row.id,
            tenant_id: row.tenant_id,
            case_id: row.case_id,
            method: row.method,
            status: row.status,
            provider_key: row.provider_key,
            result_meta: row.result_meta,
            score: row.score,
            started_at: row.started_at.to_rfc3339(),
            completed_at: row.completed_at.map(|d| d.to_rfc3339()),
        }
    }

    /// Create a new verification case
    pub async fn create(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        req: &crate::modules::verification_cases::dto::CreateVerificationCaseRequest,
    ) -> Result<CreatedCaseResponse> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        // Find the policy
        let policy: VerificationPolicyRow = sqlx::query_as(
            "SELECT id, tenant_id, name, methods, claim_type, level FROM verification_policy WHERE tenant_id = $1 AND name = $2",
        )
        .bind(tenant_id)
        .bind(&req.policy_name)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("No policy named '{}' for this tenant", req.policy_name))?;

        if policy.methods.is_empty() {
            return Err(anyhow!("Policy '{}' has no methods configured", req.policy_name));
        }

        // Verify subject exists
        let subject: SubjectSummaryRow = sqlx::query_as(
            "SELECT id, given_name, family_name, email, phone FROM subject WHERE id = $1",
        )
        .bind(&req.subject_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Subject not found"))?;

        // Create the verification case
        let kase: VerificationCaseRow = sqlx::query_as(
            r#"
            INSERT INTO verification_case (id, tenant_id, subject_id, policy_id, status, claim_type, level)
            VALUES (gen_random_uuid(), $1, $2, $3, 'PENDING', $4, $5)
            RETURNING id, tenant_id, subject_id, policy_id, status, temporal_workflow_id, decision, reviewer_id, claim_type, level, created_at, updated_at, resolved_at
            "#,
        )
        .bind(tenant_id)
        .bind(&req.subject_id)
        .bind(&policy.id)
        .bind(&policy.claim_type)
        .bind(&policy.level)
        .fetch_one(&mut *conn)
        .await?;

        // Create method attempts for each method in the policy
        for method in &policy.methods {
            sqlx::query(
                r#"
                INSERT INTO verification_method_attempt (id, tenant_id, case_id, method, provider_key, status)
                VALUES (gen_random_uuid(), $1, $2, $3, $3, 'PENDING')
                "#,
            )
            .bind(tenant_id)
            .bind(&kase.id)
            .bind(method)
            .execute(&mut *conn)
            .await?;
        }

        // Set temporal workflow ID
        let workflow_id = format!("verification-{}", kase.id);
        let updated: VerificationCaseRow = sqlx::query_as(
            r#"
            UPDATE verification_case SET temporal_workflow_id = $1
            WHERE id = $2
            RETURNING id, tenant_id, subject_id, policy_id, status, temporal_workflow_id, decision, reviewer_id, claim_type, level, created_at, updated_at, resolved_at
            "#,
        )
        .bind(&workflow_id)
        .bind(&kase.id)
        .fetch_one(&mut *conn)
        .await?;

        // Generate session token for the subject
        let session = generate_session_token();
        let session_ttl_minutes: i64 = self.env.session_ttl_minutes as i64;
        let expires_at = Utc::now() + chrono::Duration::minutes(session_ttl_minutes);

        sqlx::query(
            r#"
            INSERT INTO verification_session (id, tenant_id, case_id, token_hash, expires_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4)
            "#,
        )
        .bind(tenant_id)
        .bind(&kase.id)
        .bind(&session.hash)
        .bind(expires_at)
        .execute(&mut *conn)
        .await?;

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, subject_id, case_id, metadata)
            VALUES (gen_random_uuid(), $1, 'API_KEY', $2, 'verification_case.create', $3, $4, NULL)
            "#,
        )
        .bind(tenant_id)
        .bind(api_key_id)
        .bind(&req.subject_id)
        .bind(&kase.id)
        .execute(&mut *conn)
        .await?;

        let hosted_url = format!("{}/session/{}", self.env.verify_ui_url, session.plaintext);

        Ok(CreatedCaseResponse {
            id: updated.id,
            tenant_id: updated.tenant_id,
            subject_id: updated.subject_id,
            policy_id: updated.policy_id,
            status: updated.status,
            temporal_workflow_id: updated.temporal_workflow_id,
            claim_type: updated.claim_type,
            level: updated.level,
            created_at: updated.created_at.to_rfc3339(),
            updated_at: updated.updated_at.to_rfc3339(),
            session_token: session.plaintext,
            hosted_url,
        })
    }

    /// List verification cases (most recent first)
    pub async fn list(
        &self,
        tenant_id: &str,
        actor_type: &str,
        actor_id: &str,
    ) -> Result<Vec<VerificationCaseWithSubject>> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        // Get cases with subject info
        let rows = sqlx::query(
            r#"
            SELECT vc.id, vc.tenant_id, vc.subject_id, vc.policy_id, vc.status, vc.temporal_workflow_id,
                   vc.decision, vc.reviewer_id, vc.claim_type, vc.level, vc.created_at, vc.updated_at, vc.resolved_at,
                   s.id as s_id, s.given_name, s.family_name, s.email, s.phone
            FROM verification_case vc
            JOIN subject s ON s.id = vc.subject_id
            ORDER BY vc.created_at DESC
            LIMIT 100
            "#,
        )
        .fetch_all(&mut *conn)
        .await?;

        let cases: Vec<VerificationCaseWithSubject> = rows
            .into_iter()
            .map(|row| VerificationCaseWithSubject {
                id: row.get("id"),
                tenant_id: row.get("tenant_id"),
                subject_id: row.get("subject_id"),
                policy_id: row.get("policy_id"),
                status: row.get("status"),
                temporal_workflow_id: row.get("temporal_workflow_id"),
                decision: row.get("decision"),
                reviewer_id: row.get("reviewer_id"),
                claim_type: row.get("claim_type"),
                level: row.get("level"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
                updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at").to_rfc3339(),
                resolved_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("resolved_at").map(|d| d.to_rfc3339()),
                subject: SubjectSummary {
                    id: row.get("s_id"),
                    given_name: row.get("given_name"),
                    family_name: row.get("family_name"),
                    email: row.get("email"),
                    phone: row.get("phone"),
                },
            })
            .collect();

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, metadata)
            VALUES (gen_random_uuid(), $1, $2, $3, 'verification_case.list', NULL)
            "#,
        )
        .bind(tenant_id)
        .bind(actor_type)
        .bind(actor_id)
        .execute(&mut *conn)
        .await?;

        Ok(cases)
    }

    /// Get verification case by ID with attempts
    pub async fn get_by_id(
        &self,
        tenant_id: &str,
        actor_type: &str,
        actor_id: &str,
        case_id: &str,
    ) -> Result<VerificationCaseWithAttempts> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        // Get the case
        let kase: VerificationCaseRow = sqlx::query_as(
            "SELECT id, tenant_id, subject_id, policy_id, status, temporal_workflow_id, decision, reviewer_id, claim_type, level, created_at, updated_at, resolved_at FROM verification_case WHERE id = $1",
        )
        .bind(case_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Verification case not found"))?;

        // Get subject
        let subject: SubjectSummaryRow = sqlx::query_as(
            "SELECT id, given_name, family_name, email, phone FROM subject WHERE id = $1",
        )
        .bind(&kase.subject_id)
        .fetch_one(&mut *conn)
        .await?;

        // Get attempts ordered by started_at ASC
        let attempts: Vec<MethodAttemptRow> = sqlx::query_as(
            "SELECT id, tenant_id, case_id, method, status, provider_key, result_meta, score, started_at, completed_at FROM verification_method_attempt WHERE case_id = $1 ORDER BY started_at ASC",
        )
        .bind(case_id)
        .fetch_all(&mut *conn)
        .await?;

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, subject_id, case_id, metadata)
            VALUES (gen_random_uuid(), $1, $2, $3, 'verification_case.read', $4, $5, NULL)
            "#,
        )
        .bind(tenant_id)
        .bind(actor_type)
        .bind(actor_id)
        .bind(&kase.subject_id)
        .bind(case_id)
        .execute(&mut *conn)
        .await?;

        Ok(VerificationCaseWithAttempts {
            id: kase.id,
            tenant_id: kase.tenant_id,
            subject_id: kase.subject_id,
            policy_id: kase.policy_id,
            status: kase.status,
            temporal_workflow_id: kase.temporal_workflow_id,
            decision: kase.decision,
            reviewer_id: kase.reviewer_id,
            claim_type: kase.claim_type,
            level: kase.level,
            created_at: kase.created_at.to_rfc3339(),
            updated_at: kase.updated_at.to_rfc3339(),
            resolved_at: kase.resolved_at.map(|d| d.to_rfc3339()),
            attempts: attempts.into_iter().map(Self::attempt_to_response).collect(),
            subject: Self::subject_to_summary(subject),
        })
    }

    /// Resolve a case (manual review decision)
    pub async fn resolve_case(
        &self,
        tenant_id: &str,
        actor_type: &str,
        actor_id: &str,
        case_id: &str,
        decision: &str,
        reason: Option<&str>,
    ) -> Result<VerificationCaseResponse> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        // Verify case is in NEEDS_REVIEW status
        let current: (String, String) = sqlx::query_as(
            "SELECT status, subject_id FROM verification_case WHERE id = $1",
        )
        .bind(case_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Verification case not found"))?;

        if current.0 != "NEEDS_REVIEW" {
            return Err(anyhow!(
                "Case is in '{}' status — only NEEDS_REVIEW cases can be manually resolved",
                current.0
            ));
        }

        let status = if decision == "APPROVE" {
            "APPROVED"
        } else if decision == "REJECT" {
            "REJECTED"
        } else {
            return Err(anyhow!("Decision must be 'APPROVE' or 'REJECT'"));
        };

        let kase: VerificationCaseRow = sqlx::query_as(
            r#"
            UPDATE verification_case
            SET status = $1, decision = $2, reviewer_id = $3, resolved_at = now()
            WHERE id = $4
            RETURNING id, tenant_id, subject_id, policy_id, status, temporal_workflow_id, decision, reviewer_id, claim_type, level, created_at, updated_at, resolved_at
            "#,
        )
        .bind(status)
        .bind(reason)
        .bind(actor_id)
        .bind(case_id)
        .fetch_one(&mut *conn)
        .await?;

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, subject_id, case_id, metadata)
            VALUES (gen_random_uuid(), $1, $2, $3, 'verification_case.resolve', $4, $5, $6::jsonb)
            "#,
        )
        .bind(tenant_id)
        .bind(actor_type)
        .bind(actor_id)
        .bind(&current.1)
        .bind(case_id)
        .bind(serde_json::json!({ "decision": status, "reason": reason }))
        .execute(&mut *conn)
        .await?;

        Ok(Self::case_to_response(kase))
    }

    /// Submit OTP code
    pub async fn submit_otp_code(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        case_id: &str,
        code: &str,
    ) -> Result<MessageResponse> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        // Verify case exists
        let exists: bool = sqlx::query("SELECT EXISTS(SELECT 1 FROM verification_case WHERE id = $1)")
            .bind(case_id)
            .fetch_one(&mut *conn)
            .await?
            .get(0);
        if !exists {
            return Err(anyhow!("Verification case not found"));
        }

        // Find the otp_sms attempt
        let attempt_id: String = sqlx::query_scalar(
            "SELECT id FROM verification_method_attempt WHERE case_id = $1 AND method = 'otp_sms'",
        )
        .bind(case_id)
        .fetch_one(&mut *conn)
        .await?;

        // Store the OTP code in result_meta for the workflow to process
        sqlx::query(
            r#"
            UPDATE verification_method_attempt
            SET result_meta = $1::jsonb
            WHERE id = $2
            "#,
        )
        .bind(serde_json::json!({ "otp_code": code }))
        .bind(&attempt_id)
        .execute(&mut *conn)
        .await?;

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, case_id, metadata)
            VALUES (gen_random_uuid(), $1, 'API_KEY', $2, 'verification_case.otp_submitted', $3, NULL)
            "#,
        )
        .bind(tenant_id)
        .bind(api_key_id)
        .bind(case_id)
        .execute(&mut *conn)
        .await?;

        Ok(MessageResponse {
            message: "OTP code submitted for verification".to_string(),
        })
    }

    /// Submit a self-reported value for a claim method
    pub async fn submit_self_report(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        case_id: &str,
        method: &str,
        reported_value: &str,
    ) -> Result<MessageResponse> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        // Find the method attempt
        let attempt_id: String = sqlx::query_scalar(
            "SELECT id FROM verification_method_attempt WHERE case_id = $1 AND method = $2",
        )
        .bind(case_id)
        .bind(method)
        .fetch_one(&mut *conn)
        .await?;

        // Store the reported value
        sqlx::query(
            r#"
            UPDATE verification_method_attempt
            SET result_meta = $1::jsonb
            WHERE id = $2
            "#,
        )
        .bind(serde_json::json!({ "reported_value": reported_value }))
        .bind(&attempt_id)
        .execute(&mut *conn)
        .await?;

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, case_id, metadata)
            VALUES (gen_random_uuid(), $1, 'API_KEY', $2, 'verification_case.self_report_submitted', $3, $4::jsonb)
            "#,
        )
        .bind(tenant_id)
        .bind(api_key_id)
        .bind(case_id)
        .bind(serde_json::json!({ "method": method }))
        .execute(&mut *conn)
        .await?;

        Ok(MessageResponse {
            message: format!("Self-reported value submitted for {}", method),
        })
    }

    /// Submit agent attestation for a claim method
    pub async fn submit_agent_attestation(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        case_id: &str,
        method: &str,
        decision: &str,
        notes: Option<&str>,
    ) -> Result<MessageResponse> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        // Find the method attempt
        let attempt_id: String = sqlx::query_scalar(
            "SELECT id FROM verification_method_attempt WHERE case_id = $1 AND method = $2",
        )
        .bind(case_id)
        .bind(method)
        .fetch_one(&mut *conn)
        .await?;

        // Store the attestation
        sqlx::query(
            r#"
            UPDATE verification_method_attempt
            SET result_meta = $1::jsonb
            WHERE id = $2
            "#,
        )
        .bind(serde_json::json!({ "decision": decision, "notes": notes }))
        .bind(&attempt_id)
        .execute(&mut *conn)
        .await?;

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, case_id, metadata)
            VALUES (gen_random_uuid(), $1, 'API_KEY', $2, 'verification_case.agent_attestation_submitted', $3, $4::jsonb)
            "#,
        )
        .bind(tenant_id)
        .bind(api_key_id)
        .bind(case_id)
        .bind(serde_json::json!({ "method": method, "decision": decision }))
        .execute(&mut *conn)
        .await?;

        Ok(MessageResponse {
            message: format!("Agent attestation submitted for {}", method),
        })
    }

    /// Submit a code (e.g. postal OTP) for a claim method
    pub async fn submit_code(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        case_id: &str,
        method: &str,
        code: &str,
    ) -> Result<MessageResponse> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        // Find the method attempt
        let attempt_id: String = sqlx::query_scalar(
            "SELECT id FROM verification_method_attempt WHERE case_id = $1 AND method = $2",
        )
        .bind(case_id)
        .bind(method)
        .fetch_one(&mut *conn)
        .await?;

        // Store the code
        sqlx::query(
            r#"
            UPDATE verification_method_attempt
            SET result_meta = $1::jsonb
            WHERE id = $2
            "#,
        )
        .bind(serde_json::json!({ "code": code }))
        .bind(&attempt_id)
        .execute(&mut *conn)
        .await?;

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, case_id, metadata)
            VALUES (gen_random_uuid(), $1, 'API_KEY', $2, 'verification_case.code_submitted', $3, $4::jsonb)
            "#,
        )
        .bind(tenant_id)
        .bind(api_key_id)
        .bind(case_id)
        .bind(serde_json::json!({ "method": method }))
        .execute(&mut *conn)
        .await?;

        Ok(MessageResponse {
            message: format!("Code submitted for {}", method),
        })
    }

    /// Submit location coordinates for a claim method
    pub async fn submit_location(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        case_id: &str,
        method: &str,
        latitude: f64,
        longitude: f64,
    ) -> Result<MessageResponse> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        // Find the method attempt
        let attempt_id: String = sqlx::query_scalar(
            "SELECT id FROM verification_method_attempt WHERE case_id = $1 AND method = $2",
        )
        .bind(case_id)
        .bind(method)
        .fetch_one(&mut *conn)
        .await?;

        // Store the location
        sqlx::query(
            r#"
            UPDATE verification_method_attempt
            SET result_meta = $1::jsonb
            WHERE id = $2
            "#,
        )
        .bind(serde_json::json!({ "latitude": latitude, "longitude": longitude }))
        .bind(&attempt_id)
        .execute(&mut *conn)
        .await?;

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, case_id, metadata)
            VALUES (gen_random_uuid(), $1, 'API_KEY', $2, 'verification_case.location_submitted', $3, $4::jsonb)
            "#,
        )
        .bind(tenant_id)
        .bind(api_key_id)
        .bind(case_id)
        .bind(serde_json::json!({ "method": method }))
        .execute(&mut *conn)
        .await?;

        Ok(MessageResponse {
            message: format!("Location submitted for {}", method),
        })
    }
}
