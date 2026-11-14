//! DTOs for permissions endpoints.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PermissionCatalogEntry {
    pub id: String,
    pub group_name: String,
    pub service_name: String,
    pub permission_key: String,
    pub label: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PermissionGroup {
    pub group_name: String,
    pub permissions: Vec<PermissionCatalogEntry>,
}
