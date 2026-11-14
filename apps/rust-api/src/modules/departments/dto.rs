//! DTOs for departments endpoints.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateDepartmentRequest {
    pub name: String,
    pub slug: String,
    #[serde(default)]
    pub default_permissions: Option<serde_json::Value>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDepartmentRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub default_permissions: Option<serde_json::Value>,
    #[serde(default)]
    pub icon: Option<Option<String>>,
    #[serde(default)]
    pub color: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
pub struct AssignDepartmentRequest {
    pub account_id: String,
    #[serde(default)]
    pub organization_id: Option<String>,
    #[serde(default)]
    pub brand_id: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DepartmentResponse {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub slug: String,
    pub default_permissions: Option<serde_json::Value>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub inherited_from_tenant: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DepartmentAssignmentResponse {
    pub id: String,
    pub account_id: String,
    pub department_id: String,
    pub tenant_id: String,
    pub organization_id: Option<String>,
    pub brand_id: Option<String>,
    pub scope: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}
