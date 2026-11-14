//! Request/Response DTOs for verification cases endpoints.

use serde::{Deserialize, Serialize};

/// Request body for POST /v1/verification-cases
#[derive(Debug, Deserialize)]
pub struct CreateVerificationCaseRequest {
    pub subject_id: String,
    pub policy_name: String,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub reference_id: Option<String>,
    #[serde(default)]
    pub account_title: Option<String>,
    #[serde(default)]
    pub organization_id: Option<String>,
}

/// Request body for POST /v1/verification-cases/:id/resolve
#[derive(Debug, Deserialize)]
pub struct ResolveCaseRequest {
    pub decision: String,
    #[serde(default)]
    pub reason: Option<String>,
}

/// Request body for POST /v1/verification-cases/:id/otp/submit
#[derive(Debug, Deserialize)]
pub struct SubmitOtpRequest {
    pub code: String,
}

/// Request body for POST /v1/verification-cases/:id/claims/:method/report
#[derive(Debug, Deserialize)]
pub struct SubmitSelfReportRequest {
    pub reported_value: String,
}

/// Request body for POST /v1/verification-cases/:id/claims/:method/agent-attest
#[derive(Debug, Deserialize)]
pub struct SubmitAgentAttestationRequest {
    pub decision: String,
    #[serde(default)]
    pub notes: Option<String>,
}

/// Request body for POST /v1/verification-cases/:id/claims/:method/code
#[derive(Debug, Deserialize)]
pub struct SubmitCodeRequest {
    pub code: String,
}

/// Request body for POST /v1/verification-cases/:id/claims/:method/location
#[derive(Debug, Deserialize)]
pub struct SubmitLocationRequest {
    pub latitude: f64,
    pub longitude: f64,
}

/// Verification case in API responses
#[derive(Debug, Clone, Serialize)]
pub struct VerificationCaseResponse {
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
    pub created_at: String,
    pub updated_at: String,
    pub resolved_at: Option<String>,
}

/// Verification case with subject info
#[derive(Debug, Clone, Serialize)]
pub struct VerificationCaseWithSubject {
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
    pub created_at: String,
    pub updated_at: String,
    pub resolved_at: Option<String>,
    pub subject: SubjectSummary,
}

/// Subject summary embedded in case response
#[derive(Debug, Clone, Serialize)]
pub struct SubjectSummary {
    pub id: String,
    pub given_name: Option<String>,
    pub family_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
}

/// Method attempt in API responses
#[derive(Debug, Clone, Serialize)]
pub struct MethodAttemptResponse {
    pub id: String,
    pub tenant_id: String,
    pub case_id: String,
    pub method: String,
    pub status: String,
    pub provider_key: String,
    pub result_meta: Option<serde_json::Value>,
    pub score: Option<f64>,
    pub started_at: String,
    pub completed_at: Option<String>,
}

/// Verification case with attempts
#[derive(Debug, Clone, Serialize)]
pub struct VerificationCaseWithAttempts {
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
    pub created_at: String,
    pub updated_at: String,
    pub resolved_at: Option<String>,
    pub attempts: Vec<MethodAttemptResponse>,
    pub subject: SubjectSummary,
}

/// Created case response (includes session token)
#[derive(Debug, Serialize)]
pub struct CreatedCaseResponse {
    pub id: String,
    pub tenant_id: String,
    pub subject_id: String,
    pub policy_id: String,
    pub status: String,
    pub temporal_workflow_id: Option<String>,
    pub claim_type: String,
    pub level: String,
    pub created_at: String,
    pub updated_at: String,
    pub session_token: String,
    pub hosted_url: String,
}

/// Generic message response
#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}
