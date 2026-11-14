//! DTOs for tenant staff endpoints.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct InviteStaffRequest {
    pub account_id: String,
    #[serde(default = "default_role")]
    pub role: String,
}

fn default_role() -> String {
    "STAFF".to_string()
}

#[derive(Debug, Clone, Serialize)]
pub struct StaffMemberResponse {
    pub id: String,
    pub tenant_id: String,
    pub account_id: String,
    pub role: String,
    pub phone: Option<String>,
    pub phone_verified: bool,
    pub created_at: String,
}
