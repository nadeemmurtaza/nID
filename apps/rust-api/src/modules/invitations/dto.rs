//! DTOs for invitations endpoints.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct SendEmailInviteRequest {
    pub email: String,
    #[serde(default)]
    pub organization_id: Option<String>,
    #[serde(default)]
    pub brand_id: Option<String>,
    #[serde(default)]
    pub role_definition_id: Option<String>,
    #[serde(default)]
    pub department_id: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SendUsernameInviteRequest {
    pub username: String,
    #[serde(default)]
    pub organization_id: Option<String>,
    #[serde(default)]
    pub brand_id: Option<String>,
    #[serde(default)]
    pub role_definition_id: Option<String>,
    #[serde(default)]
    pub department_id: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AcceptInvitationRequest {
    pub invitation_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub enum InvitationStatus {
    #[serde(rename = "PENDING")]
    Pending,
    #[serde(rename = "ACCEPTED")]
    Accepted,
    #[serde(rename = "DECLINED")]
    Declined,
    #[serde(rename = "EXPIRED")]
    Expired,
    #[serde(rename = "REVOKED")]
    Revoked,
}

#[derive(Debug, Clone, Serialize)]
pub struct InvitationResponse {
    pub id: String,
    pub tenant_id: String,
    pub email: Option<String>,
    pub username: Option<String>,
    pub invited_by: String,
    pub organization_id: Option<String>,
    pub brand_id: Option<String>,
    pub scope: String,
    pub role_definition_id: Option<String>,
    pub department_id: Option<String>,
    pub status: String,
    pub expires_at: String,
    pub accepted_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}
