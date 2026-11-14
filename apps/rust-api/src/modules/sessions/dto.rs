//! Sessions DTOs.

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SessionStatusResponse {
    pub case_id: String,
    pub status: String,
    pub level: String,
    pub claim_type: String,
    pub resolved_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}
