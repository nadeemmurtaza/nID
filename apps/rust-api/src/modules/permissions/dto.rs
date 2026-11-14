//! DTOs for permissions endpoints.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionCatalogEntry {
    pub id: String,
    pub group_name: String,
    pub service_name: String,
    pub permission_key: String,
    pub label: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionGroup {
    pub group_name: String,
    pub permissions: Vec<PermissionCatalogEntry>,
}
