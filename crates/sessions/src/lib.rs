//! Sessions service — subject-facing verification session operations.
//!
//! Extracted from `apps/rust-api/src/modules/sessions/service.rs` as part of
//! CONVENTIONS.md's crates/services split.

use anyhow::{anyhow, Result};
use nid_shared_types::sha256_hex;
use sqlx::{FromRow, PgPool};
use tracing::info;

const CLAIM_DOCUMENT_METHODS: &[&str] =
    &["dob_document", "education_document", "employment_document", "address_utility_bill"];

const SELF_REPORT_METHODS: &[&str] = &["ecp_voter_registration"];

const CODE_SUBMISSION_METHODS: &[&str] = &["address_postal_otp"];

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
    phone: Option<String>,
}

/// Inline replacement for monolith's `core::upload::UploadedFile`.
#[derive(Debug, Clone)]
pub struct UploadedFile {
    pub buffer: Vec<u8>,
    pub filename: String,
    pub content_type: String,
}

// --- Public response types ---

#[derive(Debug, Clone)]
pub struct SessionStatusResponse {
    pub case_id: String,
    pub status: String,
    pub claim_type: String,
    pub level: String,
    pub resolved_at: Option<String>,
    pub attempts: Vec<AttemptEntry>,
    pub phone: String,
}

#[derive(Debug, Clone)]
pub struct AttemptEntry {
    pub method: String,
    pub status: String,
}

#[derive(Debug, Clone)]
pub struct AcceptedResponse {
    pub accepted: bool,
}

// --- Service ---

pub struct SessionsService {
    db: PgPool,
    storage: Option<std::sync::Arc<nid_storage::LocalStorageDriver>>,
}

impl SessionsService {
    pub fn new(db: PgPool) -> Self {
        Self { db, storage: None }
    }

    pub fn with_storage(mut self, storage: std::sync::Arc<nid_storage::LocalStorageDriver>) -> Self {
        self.storage = Some(storage);
        self
    }

    /// Persist an upload and return its storage key. The type is decided by
    /// the file's leading bytes, never by the client-supplied MIME type.
    /// Record an upload on the case's attempt for `method`. Case creation
    /// already makes a PENDING attempt per policy method, so this fills its
    /// `result_meta`; a method the policy did not list gets a new PENDING one.
    /// The workflow, not the upload, decides pass or fail.
    async fn record_attempt(
        conn: &mut sqlx::PgConnection,
        tenant_id: &str,
        case_id: &str,
        method: &str,
        meta: serde_json::Value,
    ) -> Result<()> {
        let updated = sqlx::query(
            "UPDATE verification_method_attempt SET result_meta = $3::jsonb, started_at = COALESCE(started_at, NOW())
             WHERE case_id = $1 AND method = $2",
        )
        .bind(case_id)
        .bind(method)
        .bind(meta.to_string())
        .execute(&mut *conn)
        .await?;
        if updated.rows_affected() == 0 {
            sqlx::query(
                "INSERT INTO verification_method_attempt (id, tenant_id, case_id, method, provider_key, status, result_meta, started_at)
                 VALUES (gen_random_uuid(), $1, $2, $3, $3, 'PENDING', $4::jsonb, NOW())",
            )
            .bind(tenant_id)
            .bind(case_id)
            .bind(method)
            .bind(meta.to_string())
            .execute(&mut *conn)
            .await?;
        }
        Ok(())
    }

    async fn store_file(&self, case_id: &str, kind: &str, file: &UploadedFile) -> Result<String> {
        use nid_storage::StorageDriver;
        let storage = self
            .storage
            .as_ref()
            .ok_or_else(|| anyhow!("File storage is not configured"))?;
        let content_type = nid_storage::sniff_content_type(&file.buffer)
            .ok_or_else(|| anyhow!("Unsupported file type: upload a JPEG, PNG, WebP or PDF"))?;
        let stored = storage
            .put(nid_storage::PutDocumentInput {
                namespace: format!("verification-{kind}"),
                group_id: case_id.to_string(),
                filename: file.filename.clone(),
                content_type: content_type.to_string(),
                body: file.buffer.clone(),
            })
            .await
            .map_err(|e| anyhow!("Failed to store file: {e}"))?;
        Ok(stored.key)
    }

    async fn resolve(&self, token: &str) -> Result<VerificationSessionRow> {
        let mut conn = self.db.acquire().await?;
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

    pub async fn get_status(&self, token: &str) -> Result<SessionStatusResponse> {
        let session = self.resolve(token).await?;
        let mut conn = self.db.begin().await?;

        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
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

        let attempts: Vec<MethodAttemptRow> = sqlx::query_as(
            "SELECT method, status FROM verification_method_attempt
             WHERE case_id = $1 ORDER BY started_at ASC",
        )
        .bind(&session.case_id)
        .fetch_all(&mut *conn)
        .await?;

        let subject: SubjectPhoneRow = sqlx::query_as(
            "SELECT phone FROM subject WHERE id = $1",
        )
        .bind(&kase.subject_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Subject not found"))?;

        conn.commit().await?;
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
            phone: subject.phone.unwrap_or_default(),
        })
    }

    pub async fn submit_otp(&self, token: &str, code: &str) -> Result<AcceptedResponse> {
        self.submit_method(
            token,
            "otp_sms",
            "verification_case.submit_otp",
            &serde_json::json!({ "submittedCode": code }),
        )
        .await
    }

    pub async fn submit_document(&self, token: &str, file: UploadedFile) -> Result<AcceptedResponse> {
        let session = self.resolve(token).await?;
        let mut conn = self.db.begin().await?;
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
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

        let url = self.store_file(&session.case_id, "document", &file).await?;

        let now = chrono::Utc::now();
        Self::record_attempt(
            &mut conn,
            &session.tenant_id,
            &session.case_id,
            "document_ocr",
            serde_json::json!({
                "storageKey": url,
                "contentType": nid_storage::sniff_content_type(&file.buffer),
                "filename": file.filename,
                "size": file.buffer.len(),
            }),
        )
        .await?;

        sqlx::query(
            "INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, subject_id, case_id, metadata, created_at)
             VALUES (gen_random_uuid(), $1, 'SUBJECT', $2, 'verification_case.submit_document', $3, $4, $5::jsonb, $6)",
        )
        .bind(&session.tenant_id)
        .bind(&kase.subject_id)
        .bind(&kase.subject_id)
        .bind(&session.case_id)
        .bind(serde_json::json!({"storageKey": url}).to_string())
        .bind(now)
        .execute(&mut *conn)
        .await?;

        info!(
            case_id = session.case_id,
            file_key = %url,
            filename = %file.filename,
            "Document uploaded successfully"
        );

        conn.commit().await?;
        Ok(AcceptedResponse { accepted: true })
    }

    pub async fn submit_liveness(&self, token: &str, files: Vec<UploadedFile>) -> Result<AcceptedResponse> {
        let session = self.resolve(token).await?;
        let mut conn = self.db.begin().await?;
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
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

        let mut frame_urls: Vec<String> = Vec::with_capacity(files.len());
        for f in &files {
            frame_urls.push(self.store_file(&session.case_id, "liveness", f).await?);
        }

        Self::record_attempt(
            &mut conn,
            &session.tenant_id,
            &session.case_id,
            "liveness",
            serde_json::json!({ "frameCount": files.len(), "storageKeys": frame_urls }),
        )
        .await?;

        info!(
            case_id = session.case_id,
            frame_count = files.len(),
            "Liveness frames uploaded successfully"
        );

        conn.commit().await?;
        Ok(AcceptedResponse { accepted: true })
    }

    pub async fn submit_claim_document(
        &self,
        token: &str,
        method: &str,
        file: UploadedFile,
    ) -> Result<AcceptedResponse> {
        if !CLAIM_DOCUMENT_METHODS.contains(&method) {
            return Err(anyhow!("\"{}\" is not a claim-document method.", method));
        }

        let session = self.resolve(token).await?;
        let mut conn = self.db.begin().await?;
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
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

        let url = self.store_file(&session.case_id, "claim", &file).await?;

        Self::record_attempt(
            &mut conn,
            &session.tenant_id,
            &session.case_id,
            method,
            serde_json::json!({
                "storageKey": url,
                "contentType": nid_storage::sniff_content_type(&file.buffer),
                "filename": file.filename,
                "size": file.buffer.len(),
            }),
        )
        .await?;

        info!(
            case_id = session.case_id,
            method,
            file_key = %url,
            "Claim document uploaded successfully"
        );

        conn.commit().await?;
        Ok(AcceptedResponse { accepted: true })
    }

    pub async fn submit_self_report(
        &self,
        token: &str,
        method: &str,
        reported_value: &str,
    ) -> Result<AcceptedResponse> {
        if !SELF_REPORT_METHODS.contains(&method) {
            return Err(anyhow!("\"{}\" is not a self-report method.", method));
        }
        self.submit_method(
            token,
            method,
            "verification_case.submit_self_report",
            &serde_json::json!({ "reportedValue": reported_value }),
        )
        .await
    }

    pub async fn submit_code(&self, token: &str, method: &str, code: &str) -> Result<AcceptedResponse> {
        if !CODE_SUBMISSION_METHODS.contains(&method) {
            return Err(anyhow!("\"{}\" is not a code-submission method.", method));
        }
        self.submit_method(
            token,
            method,
            "verification_case.submit_code",
            &serde_json::json!({ "submittedCode": code }),
        )
        .await
    }

    pub async fn submit_location(
        &self,
        token: &str,
        method: &str,
        latitude: f64,
        longitude: f64,
    ) -> Result<AcceptedResponse> {
        if !LOCATION_METHODS.contains(&method) {
            return Err(anyhow!("\"{}\" is not a location method.", method));
        }
        self.submit_method(
            token,
            method,
            "verification_case.submit_location",
            &serde_json::json!({ "latitude": latitude, "longitude": longitude }),
        )
        .await
    }

    async fn submit_method(
        &self,
        token: &str,
        method: &str,
        action: &str,
        payload: &serde_json::Value,
    ) -> Result<AcceptedResponse> {
        let session = self.resolve(token).await?;
        let mut conn = self.db.begin().await?;
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
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

        let now = chrono::Utc::now();
        sqlx::query(
            "INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, subject_id, case_id, metadata, created_at)
             VALUES (gen_random_uuid(), $1, 'SUBJECT', $2, $3, $4, $5, $6::jsonb, $7)",
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

        info!(
            case_id = session.case_id,
            method,
            workflow_id = ?kase.temporal_workflow_id,
            "Method submission — Temporal signaling not yet implemented"
        );

        conn.commit().await?;
        Ok(AcceptedResponse { accepted: true })
    }
}
