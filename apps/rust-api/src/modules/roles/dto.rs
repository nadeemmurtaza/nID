//! Request/Response DTOs for roles endpoints.

use serde::{Deserialize, Serialize};

/// Request body for POST /v1/roles
#[derive(Debug, Deserialize)]
pub struct CreateRoleRequest {
    pub name: String,
    pub slug: String,
    pub permissions: serde_json::Value,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_system: bool,
}

/// Request body for PATCH /v1/roles/:id
#[derive(Debug, Deserialize)]
pub struct UpdateRoleRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub permissions: Option<serde_json::Value>,
    #[serde(default)]
    pub description: Option<Option<String>>,
}

/// Request body for POST /v1/roles/:id/assign
#[derive(Debug, Deserialize)]
pub struct AssignRoleRequest {
    pub account_id: String,
    #[serde(default)]
    pub organization_id: Option<String>,
    #[serde(default)]
    pub brand_id: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
}

/// Role definition in API responses
#[derive(Debug, Clone, Serialize)]
pub struct RoleResponse {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub slug: String,
    pub permissions: serde_json::Value,
    pub description: Option<String>,
    pub is_system: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Role assignment response
#[derive(Debug, Clone, Serialize)]
pub struct RoleAssignmentResponse {
    pub id: String,
    pub account_id: String,
    pub role_definition_id: String,
    pub tenant_id: String,
    pub organization_id: Option<String>,
    pub brand_id: Option<String>,
    pub scope: String,
    pub created_at: String,
}

/// Generic message response
#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}
