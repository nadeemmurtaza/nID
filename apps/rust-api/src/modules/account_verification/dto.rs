//! DTOs for account verification endpoints.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateSelfVerificationCaseRequest {
    pub claim_type: String,
    #[serde(default)]
    pub level: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct VerificationStatusResponse {
    pub account_id: String,
    pub badges: Vec<BadgeEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BadgeEntry {
    pub claim_type: String,
    pub level: String,
    pub verified_at: Option<String>,
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
