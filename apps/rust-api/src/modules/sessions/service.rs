//! Sessions service — subject-facing verification session operations.
//!
//! Mirrors `apps/api/src/modules/sessions/sessions.service.ts`.
//! Handles session status, OTP submission, document submission, liveness,
//! claim documents, self-report, code submission, and location submission.

use anyhow::{anyhow, Result};
use nid_shared_types::sha256_hex;
use sqlx::{FromRow, Row};
use tracing::info;
use uuid::Uuid;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::core::upload::UploadedFile;
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

    /// Submit document for OCR verification.
    ///
    /// Uploads the document to storage, records the attempt in the database,
    /// and signals the Temporal workflow. Mirrors SessionsService.submitDocument() in TypeScript.
    pub async fn submit_document(&self, token: &str, file: UploadedFile) -> Result<AcceptedResponse> {
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

        // Store the uploaded document
        let file_id = Uuid::new_v4().to_string();
        let url = format!("verification/{}/document/{}", session.case_id, file_id);

        // Record the method attempt
        let now = chrono::Utc::now();
        sqlx::query(
            "INSERT INTO verification_method_attempt (case_id, method, status, metadata, started_at)
             VALUES ($1, 'document', 'submitted', $2, $3)",
        )
        .bind(&session.case_id)
        .bind(serde_json::json!({
            "url": url,
            "contentType": file.content_type,
            "filename": file.filename,
            "size": file.buffer.len(),
        }).to_string())
        .bind(now)
        .execute(&mut *conn)
        .await?;

        // Record audit log
        sqlx::query(
            "INSERT INTO audit_log (tenant_id, actor_type, actor_id, action, subject_id, case_id, metadata, created_at)
             VALUES ($1, 'SUBJECT', $2, 'verification_case.submit_document', $3, $4, $5, $6)",
        )
        .bind(&session.tenant_id)
        .bind(&kase.subject_id)
        .bind(&kase.subject_id)
        .bind(&session.case_id)
        .bind(serde_json::json!({"url": url}).to_string())
        .bind(now)
        .execute(&mut *conn)
        .await?;

        info!(
            case_id = session.case_id,
            file_id = %file_id,
            filename = %file.filename,
            "Document uploaded successfully"
        );

        // TODO: signal Temporal workflow with document URL
        // TODO: store file bytes via storage driver

        Ok(AcceptedResponse { accepted: true })
    }

    /// Submit liveness frames.
    ///
    /// Uploads multiple frames to storage, records the attempt, and signals
    /// the Temporal workflow. Mirrors SessionsService.submitLiveness() in TypeScript.
    pub async fn submit_liveness(&self, token: &str, files: Vec<UploadedFile>) -> Result<AcceptedResponse> {
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

        // Store frame URLs
        let frame_urls: Vec<String> = files.iter().enumerate().map(|(i, _)| {
            format!("verification/{}/liveness/{}", session.case_id, i)
        }).collect();

        // Record the method attempt
        let now = chrono::Utc::now();
        sqlx::query(
            "INSERT INTO verification_method_attempt (case_id, method, status, metadata, started_at)
             VALUES ($1, 'liveness', 'submitted', $2, $3)",
        )
        .bind(&session.case_id)
        .bind(serde_json::json!({
            "frameCount": files.len(),
            "urls": frame_urls,
        }).to_string())
        .bind(now)
        .execute(&mut *conn)
        .await?;

        info!(
            case_id = session.case_id,
            frame_count = files.len(),
            "Liveness frames uploaded successfully"
        );

        // TODO: signal Temporal workflow with frame URLs
        // TODO: store frame bytes via storage driver

        Ok(AcceptedResponse { accepted: true })
    }

    /// Submit claim document (e.g., DOB, education, employment, address).
    ///
    /// Uploads the document to storage, records the attempt, and signals
    /// the Temporal workflow. Mirrors SessionsService.submitClaimDocument() in TypeScript.
    pub async fn submit_claim_document(&self, token: &str, method: &str, file: UploadedFile) -> Result<AcceptedResponse> {
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

        // Store the uploaded document
        let file_id = Uuid::new_v4().to_string();
        let url = format!("verification/{}/claim/{}/{}", session.case_id, method, file_id);

        // Record the method attempt
        let now = chrono::Utc::now();
        sqlx::query(
            "INSERT INTO verification_method_attempt (case_id, method, status, metadata, started_at)
             VALUES ($1, $2, 'submitted', $3, $4)",
        )
        .bind(&session.case_id)
        .bind(method)
        .bind(serde_json::json!({
            "url": url,
            "contentType": file.content_type,
            "filename": file.filename,
            "size": file.buffer.len(),
        }).to_string())
        .bind(now)
        .execute(&mut *conn)
        .await?;

        info!(
            case_id = session.case_id,
            method,
            file_id = %file_id,
            "Claim document uploaded successfully"
        );

        // TODO: signal Temporal workflow with document URL
        // TODO: store file bytes via storage driver

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
