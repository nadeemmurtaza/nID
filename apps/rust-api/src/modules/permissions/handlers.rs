//! HTTP handlers for permissions endpoints.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::permissions::dto::{PermissionCatalogEntry, PermissionGroup};
use crate::modules::permissions::service::PermissionsService;

pub struct PermissionsState {
    pub service: PermissionsService,
    pub env: AppEnv,
}

/// GET /v1/permissions/catalog
pub async fn get_catalog(
    State(state): State<Arc<PermissionsState>>,
) -> Result<Json<Vec<PermissionGroup>>, (StatusCode, Json<serde_json::Value>)> {
    let catalog = state.service.get_catalog().await.map_err(internal_error)?;
    Ok(Json(catalog))
}

/// GET /v1/permissions/all
pub async fn get_all(
    State(state): State<Arc<PermissionsState>>,
) -> Result<Json<Vec<PermissionCatalogEntry>>, (StatusCode, Json<serde_json::Value>)> {
    let perms = state.service.get_all_permissions().await.map_err(internal_error)?;
    Ok(Json(perms))
}

/// GET /v1/permissions/group/:groupName
pub async fn get_group(
    Path(group_name): Path<String>,
    State(state): State<Arc<PermissionsState>>,
) -> Result<Json<Vec<PermissionCatalogEntry>>, (StatusCode, Json<serde_json::Value>)> {
    let perms = state.service.get_group_permissions(&group_name).await.map_err(internal_error)?;
    Ok(Json(perms))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %err, "Internal error");
    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "message": err.to_string() })))
}
