//! Request/Response DTOs for tenants endpoints.

use serde::{Deserialize, Serialize};

/// Request body for POST /v1/tenants
#[derive(Debug, Deserialize)]
pub struct CreateTenantRequest {
    pub name: String,
    pub slug: String,
    #[serde(default)]
    pub data_residency_region: Option<String>,
    #[serde(default)]
    pub webhook_url: Option<String>,
    #[serde(default)]
    pub billing_webhook_url: Option<String>,
    #[serde(default)]
    pub initial_staff_account_id: Option<String>,
}

/// Request body for PUT /v1/tenants/:id
#[derive(Debug, Deserialize)]
pub struct UpdateTenantRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub data_residency_region: Option<String>,
    #[serde(default)]
    pub webhook_url: Option<Option<String>>,
    #[serde(default)]
    pub webhook_secret_plaintext: Option<Option<String>>,
    #[serde(default)]
    pub billing_webhook_url: Option<Option<String>>,
    #[serde(default)]
    pub billing_webhook_secret_plaintext: Option<Option<String>>,
}

/// Request body for POST /v1/tenants/:id/api-keys
#[derive(Debug, Deserialize)]
pub struct CreateApiKeyRequest {
    #[serde(default)]
    pub key_prefix: Option<String>,
    #[serde(default)]
    pub scopes: Option<Vec<String>>,
    #[serde(default)]
    pub rate_limit_per_minute: Option<i32>,
}

/// Request body for POST /v1/tenants/:id/staff
#[derive(Debug, Deserialize)]
pub struct InviteStaffRequest {
    pub account_id: String,
    #[serde(default = "default_staff_role")]
    pub role: String,
}

fn default_staff_role() -> String {
    "STAFF".to_string()
}

/// Tenant in API responses
#[derive(Debug, Clone, Serialize)]
pub struct TenantResponse {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub data_residency_region: String,
    pub webhook_url: Option<String>,
    pub billing_webhook_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Tenant with counts (for listAll/getById)
#[derive(Debug, Clone, Serialize)]
pub struct TenantWithCounts {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub data_residency_region: String,
    pub webhook_url: Option<String>,
    pub billing_webhook_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub api_keys_count: i64,
    pub staff_count: i64,
    pub subjects_count: i64,
    pub cases_count: i64,
}

/// Tenant with "who is signed in" info
#[derive(Debug, Clone, Serialize)]
pub struct TenantSelfResponse {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub data_residency_region: String,
    pub webhook_url: Option<String>,
    pub billing_webhook_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub signed_in_as: String,
}

/// Tenant membership for an account
#[derive(Debug, Clone, Serialize)]
pub struct TenantMembership {
    pub tenant_id: String,
    pub tenant_name: String,
    pub tenant_slug: String,
    pub role: String,
}

/// API key response
#[derive(Debug, Clone, Serialize)]
pub struct ApiKeyResponse {
    pub id: String,
    pub key_prefix: String,
    pub scopes: Vec<String>,
    pub rate_limit_per_minute: i32,
    pub revoked_at: Option<String>,
    pub created_at: String,
}

/// New API key response (includes plaintext)
#[derive(Debug, Clone, Serialize)]
pub struct NewApiKeyResponse {
    pub prefix: String,
    pub plaintext: String,
    pub message: String,
}

/// Created tenant response (includes secrets)
#[derive(Debug, Clone, Serialize)]
pub struct CreatedTenantResponse {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub data_residency_region: String,
    pub webhook_url: Option<String>,
    pub webhook_secret: String,
    pub billing_webhook_url: Option<String>,
    pub billing_webhook_secret: String,
    pub created_at: String,
    pub message: String,
}

/// Staff member response
#[derive(Debug, Clone, Serialize)]
pub struct StaffMemberResponse {
    pub id: String,
    pub account_id: String,
    pub role: String,
    pub phone: Option<String>,
    pub phone_verified: bool,
}

/// Generic message response
#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}
