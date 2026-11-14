//! Sessions service — subject-facing verification session operations.
//!
//! Mirrors `apps/api/src/modules/sessions/sessions.service.ts`.
//! Handles session status, OTP submission, document submission, liveness,
//! claim documents, self-report, code submission, and location submission.

use anyhow::{anyhow, Result};
use nid_shared_types::sha256_hex;
use sqlx::{FromRow, Row};
use tracing::info;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::sessions::dto::{
    AcceptedResponse, AttemptEntry, SessionStatusResponse,
};

/// Methods reachable through the generic .../claims/:method/submit route.
const CLAIM_DOCUMENT_METHODS: &[&str] =
    &["dob_document", "education_document", "employment_document", "address_utility_bill"];

/// Methods reachable through the generic .../claims/:method/report route.
const SELF_REPORT_METHODS: &[&str] = &["ecp_voter_registration"];

/// Methods reachable through the generic .../claims/:method/code route.
const CODE_SUBMISSION_METHODS: &[&str] = &["address_postal_otp"];

/// Methods reachable through the generic .../claims/:method/location route.
const LOCATION_METHODS: &[&str] = &["address_gps_match"];

#[derive(Debug, Clone, FromRow)]
struct VerificationSessionRow {
    tenant_id: String,
    case_id: String,
    expires_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, FromRow)]
struct VerificationCaseRow {
    id: String,
    status: String,
    level: String,
    claim_type: String,
    subject_id: String,
    resolved_at: Option<chrono::DateTime<chrono::Utc>>,
    temporal_workflow_id: Option<String>,
}

#[derive(Debug, Clone, FromRow)]
struct MethodAttemptRow {
    method: String,
    status: String,
}

#[derive(Debug, Clone, FromRow)]
struct SubjectPhoneRow {
    phone: String,
}

pub struct SessionsService {
    db: DbPool,
    env: AppEnv,
}

impl SessionsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    /// Resolve a session token to the session row.
    async fn resolve(&self, token: &str) -> Result<VerificationSessionRow> {
        let conn = self.db.get().await?;
        let token_hash = sha256_hex(token);

        let session: VerificationSessionRow = sqlx::query_as(
            "SELECT tenant_id, case_id, expires_at FROM verification_session WHERE token_hash = $1",
        )
        .bind(&token_hash)
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| anyhow!("This verification link is invalid or has expired."))?;

        if chrono::Utc::now() > session.expires_at {
            return Err(anyhow!("This verification link is invalid or has expired."));
        }

        Ok(session)
    }

    /// Get full session status with attempts and phone.
    ///
    /// Mirrors SessionsService.getStatus() — returns attempts ordered by startedAt
    /// so apps/verify-ui can determine the current step.
    pub async fn get_status(&self, token: &str) -> Result<SessionStatusResponse> {
        let session = self.resolve(token).await?;
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(&session.tenant_id)
            .execute(&mut *conn)
            .await?;

        // Get the case
        let kase: VerificationCaseRow = sqlx::query_as(
            "SELECT id, status, level, claim_type, subject_id, resolved_at, temporal_workflow_id
             FROM verification_case WHERE id = $1",
        )
        .bind(&session.case_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Verification case not found"))?;

        // Get attempts ordered by startedAt
        let attempts: Vec<MethodAttemptRow> = sqlx::query_as(
            "SELECT method, status FROM verification_method_attempt
             WHERE case_id = $1 ORDER BY started_at ASC",
        )
        .bind(&session.case_id)
        .fetch_all(&mut *conn)
        .await?;

        // Get subject phone
        let subject: SubjectPhoneRow = sqlx::query_as(
            "SELECT phone FROM subject WHERE id = $1",
        )
        .bind(&kase.subject_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Subject not found"))?;

        Ok(SessionStatusResponse {
            case_id: session.case_id,
            status: kase.status,
            claim_type: kase.claim_type,
            level: kase.level,
            resolved_at: kase.resolved_at.map(|d| d.to_rfc3339()),
            attempts: attempts
                .into_iter()
                .map(|a| AttemptEntry {
                    method: a.method,
                    status: a.status,
                })
                .collect(),
            phone: subject.phone,
        })
    }

    /// Submit OTP code for verification.
    pub async fn submit_otp(&self, token: &str, code: &str) -> Result<AcceptedResponse> {
        self.submit_method(token, "otp_sms", "verification_case.submit_otp", &serde_json::json!({ "submittedCode": code })).await
    }

    /// Submit document for OCR verification (stub — requires file upload).
    pub async fn submit_document(&self, token: &str) -> Result<AcceptedResponse> {
        let session = self.resolve(token).await?;
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1")
            .bind(&session.tenant_id)
            .execute(&mut *conn)
            .await?;

        let kase: VerificationCaseRow = sqlx::query_as(
            "SELECT id, status, level, claim_type, subject_id, resolved_at, temporal_workflow_id
             FROM verification_case WHERE id = $1",
        )
        .bind(&session.case_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Verification case not found"))?;

        if kase.temporal_workflow_id.is_none() {
            return Err(anyhow!("This verification is no longer accepting submissions."));
        }

        // TODO: implement file upload handling with multipart form parsing
        // and storage integration (mirrors submitUploadedMethod in TS)
        info!(case_id = session.case_id, "Document upload stub — file upload not yet implemented");

        Ok(AcceptedResponse { accepted: true })
    }

    /// Submit liveness frames (stub — requires file upload).
    pub async fn submit_liveness(&self, token: &str) -> Result<AcceptedResponse> {
        let session = self.resolve(token).await?;
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1")
            .bind(&session.tenant_id)
            .execute(&mut *conn)
            .await?;

        let kase: VerificationCaseRow = sqlx::query_as(
            "SELECT id, status, level, claim_type, subject_id, resolved_at, temporal_workflow_id
             FROM verification_case WHERE id = $1",
        )
        .bind(&session.case_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Verification case not found"))?;

        if kase.temporal_workflow_id.is_none() {
            return Err(anyhow!("This verification is no longer accepting submissions."));
        }

        // TODO: implement multi-frame upload handling
        info!(case_id = session.case_id, "Liveness upload stub — file upload not yet implemented");

        Ok(AcceptedResponse { accepted: true })
    }

    /// Submit claim document (stub — requires file upload).
    pub async fn submit_claim_document(&self, token: &str, method: &str) -> Result<AcceptedResponse> {
        if !CLAIM_DOCUMENT_METHODS.contains(&method) {
            return Err(anyhow!("\"{}\" is not a claim-document method.", method));
        }

        let session = self.resolve(token).await?;
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1")
            .bind(&session.tenant_id)
            .execute(&mut *conn)
            .await?;

        let kase: VerificationCaseRow = sqlx::query_as(
            "SELECT id, status, level, claim_type, subject_id, resolved_at, temporal_workflow_id
             FROM verification_case WHERE id = $1",
        )
        .bind(&session.case_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Verification case not found"))?;

        if kase.temporal_workflow_id.is_none() {
            return Err(anyhow!("This verification is no longer accepting submissions."));
        }

        // TODO: implement file upload handling
        info!(case_id = session.case_id, method, "Claim document upload stub — file upload not yet implemented");

        Ok(AcceptedResponse { accepted: true })
    }

    /// Submit self-reported value (e.g., ECP voter registration).
    pub async fn submit_self_report(&self, token: &str, method: &str, reported_value: &str) -> Result<AcceptedResponse> {
        if !SELF_REPORT_METHODS.contains(&method) {
            return Err(anyhow!("\"{}\" is not a self-report method.", method));
        }
        self.submit_method(token, method, "verification_case.submit_self_report", &serde_json::json!({ "reportedValue": reported_value })).await
    }

    /// Submit code (e.g., postal OTP).
    pub async fn submit_code(&self, token: &str, method: &str, code: &str) -> Result<AcceptedResponse> {
        if !CODE_SUBMISSION_METHODS.contains(&method) {
            return Err(anyhow!("\"{}\" is not a code-submission method.", method));
        }
        self.submit_method(token, method, "verification_case.submit_code", &serde_json::json!({ "submittedCode": code })).await
    }

    /// Submit GPS location.
    pub async fn submit_location(&self, token: &str, method: &str, latitude: f64, longitude: f64) -> Result<AcceptedResponse> {
        if !LOCATION_METHODS.contains(&method) {
            return Err(anyhow!("\"{}\" is not a location method.", method));
        }
        self.submit_method(token, method, "verification_case.submit_location", &serde_json::json!({ "latitude": latitude, "longitude": longitude })).await
    }

    /// Generic method submission — records audit log and signals Temporal workflow.
    ///
    /// Mirrors SessionsService.submitMethod() in TypeScript.
    async fn submit_method(
        &self,
        token: &str,
        method: &str,
        action: &str,
        payload: &serde_json::Value,
    ) -> Result<AcceptedResponse> {
        let session = self.resolve(token).await?;
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1")
            .bind(&session.tenant_id)
            .execute(&mut *conn)
            .await?;

        let kase: VerificationCaseRow = sqlx::query_as(
            "SELECT id, status, level, claim_type, subject_id, resolved_at, temporal_workflow_id
             FROM verification_case WHERE id = $1",
        )
        .bind(&session.case_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Verification case not found"))?;

        if kase.temporal_workflow_id.is_none() {
            return Err(anyhow!("This verification is no longer accepting submissions."));
        }

        // Record audit log entry
        let now = chrono::Utc::now();
        sqlx::query(
            "INSERT INTO audit_log (tenant_id, actor_type, actor_id, action, subject_id, case_id, metadata, created_at)
             VALUES ($1, 'SUBJECT', $2, $3, $4, $5, $6, $7)",
        )
        .bind(&session.tenant_id)
        .bind(&kase.subject_id)
        .bind(action)
        .bind(&kase.subject_id)
        .bind(&session.case_id)
        .bind(payload.to_string())
        .bind(now)
        .execute(&mut *conn)
        .await?;

        // TODO: signal Temporal workflow with method payload
        info!(
            case_id = session.case_id,
            method,
            workflow_id = ?kase.temporal_workflow_id,
            "Method submission — Temporal signaling not yet implemented"
        );

        Ok(AcceptedResponse { accepted: true })
    }
}
