//! Request/Response DTOs for access control endpoints.

use serde::{Deserialize, Serialize};

/// Access type for grants
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AccessType {
    Owner,
    Partner,
    Admin,
    Member,
}

/// Status of an access grant
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AccessGrantStatus {
    Active,
    Revoked,
    Pending,
}

/// Request body for POST /v1/access/grant
#[derive(Debug, Deserialize)]
pub struct CreateGrantRequest {
    pub account_id: String,
    #[serde(default)]
    pub organization_id: Option<String>,
    #[serde(default)]
    pub brand_id: Option<String>,
    pub access_type: AccessType,
    #[serde(default)]
    pub partnership_percentage: Option<f64>,
}

/// Request body for PATCH /v1/access/grant/:id
#[derive(Debug, Deserialize)]
pub struct UpdateGrantRequest {
    #[serde(default)]
    pub access_type: Option<AccessType>,
    #[serde(default)]
    pub partnership_percentage: Option<f64>,
    #[serde(default)]
    pub status: Option<AccessGrantStatus>,
}

/// Request body for POST /v1/access/transfer-ownership
#[derive(Debug, Deserialize)]
pub struct TransferOwnershipRequest {
    pub new_owner_id: String,
    #[serde(default)]
    pub organization_id: Option<String>,
    #[serde(default)]
    pub brand_id: Option<String>,
}

/// Request body for POST /v1/access/partner
#[derive(Debug, Deserialize)]
pub struct AddPartnerRequest {
    pub account_id: String,
    pub percentage: f64,
}

/// Access grant in API responses
#[derive(Debug, Clone, Serialize)]
pub struct AccessGrantResponse {
    pub id: String,
    pub account_id: String,
    pub tenant_id: String,
    pub organization_id: Option<String>,
    pub brand_id: Option<String>,
    pub access_type: String,
    pub partnership_percentage: Option<f64>,
    pub granted_by: String,
    pub status: String,
    pub granted_at: String,
    pub account_phone: Option<String>,
    pub account_email: Option<String>,
}

/// Permission entry for my-permissions endpoint
#[derive(Debug, Clone, Serialize)]
pub struct PermissionEntry {
    pub group_name: String,
    pub service_name: String,
    pub permission_key: String,
    pub label: String,
    pub granted: bool,
}

/// My permissions response
#[derive(Debug, Serialize)]
pub struct MyPermissionsResponse {
    pub account_id: String,
    pub tenant_id: String,
    pub permissions: Vec<PermissionEntry>,
}

/// Generic message response
#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}
