//! Sessions DTOs — mirrors apps/api/src/modules/sessions/ response types.

use serde::{Deserialize, Serialize};

/// Full session status with attempts and phone (returned by GET /v1/sessions/:token/status).
#[derive(Debug, Serialize)]
pub struct SessionStatusResponse {
    pub case_id: String,
    pub status: String,
    pub claim_type: String,
    pub level: String,
    pub resolved_at: Option<String>,
    /// Ordered attempts — apps/verify-ui walks this list to know which step is next.
    pub attempts: Vec<AttemptEntry>,
    pub phone: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AttemptEntry {
    pub method: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct AcceptedResponse {
    pub accepted: bool,
}

/// Request body for POST /v1/sessions/:token/otp/submit
#[derive(Debug, Deserialize)]
pub struct SubmitOtpRequest {
    pub code: String,
}

/// Request body for POST /v1/sessions/:token/claims/:method/report
#[derive(Debug, Deserialize)]
pub struct SubmitSelfReportRequest {
    pub reported_value: String,
}

/// Request body for POST /v1/sessions/:token/claims/:method/code
#[derive(Debug, Deserialize)]
pub struct SubmitCodeRequest {
    pub code: String,
}

/// Request body for POST /v1/sessions/:token/claims/:method/location
#[derive(Debug, Deserialize)]
pub struct SubmitLocationRequest {
    pub latitude: f64,
    pub longitude: f64,
}
