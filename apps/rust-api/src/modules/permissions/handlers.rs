//! HTTP handlers for permissions endpoints.
//!
//! Mirrors `apps/api/src/modules/permission/permission.controller.ts`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::session::AccountSession;
use crate::core::config::AppEnv;
use crate::modules::permissions::dto::{PermissionCatalogEntry, PermissionGroup};
use crate::modules::permissions::service::PermissionsService;

pub struct PermissionsState {
    pub service: PermissionsService,
    pub env: AppEnv,
}

/// GET /v1/permissions/catalog
pub async fn get_catalog(
    _account: AccountSession,
    State(state): State<Arc<PermissionsState>>,
) -> Result<Json<Vec<PermissionGroup>>, (StatusCode, Json<serde_json::Value>)> {
    let catalog = state.service.get_catalog().await.map_err(internal_error)?;
    Ok(Json(catalog))
}

/// GET /v1/permissions/all
pub async fn get_all(
    _account: AccountSession,
    State(state): State<Arc<PermissionsState>>,
) -> Result<Json<Vec<PermissionCatalogEntry>>, (StatusCode, Json<serde_json::Value>)> {
    let perms = state.service.get_all_permissions().await.map_err(internal_error)?;
    Ok(Json(perms))
}

/// GET /v1/permissions/group/:groupName
pub async fn get_group(
    _account: AccountSession,
    Path(group_name): Path<String>,
    State(state): State<Arc<PermissionsState>>,
) -> Result<Json<Vec<PermissionCatalogEntry>>, (StatusCode, Json<serde_json::Value>)> {
    let perms = state.service.get_group_permissions(&group_name).await.map_err(internal_error)?;
    Ok(Json(perms))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}
