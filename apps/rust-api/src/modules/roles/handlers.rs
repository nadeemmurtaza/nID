//! HTTP handlers for roles endpoints.
//!
//! Mirrors `apps/api/src/modules/role/role.controller.ts`.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::roles::dto::{
    AssignRoleRequest, CreateRoleRequest, MessageResponse, RoleAssignmentResponse,
    RoleResponse, UpdateRoleRequest,
};
use crate::modules::roles::service::RolesService;

pub struct RolesState {
    pub service: RolesService,
    pub env: AppEnv,
}

#[derive(Debug, serde::Deserialize)]
pub struct RolesQuery {
    #[serde(default)]
    pub tenant_id: String,
}

/// POST /v1/roles
pub async fn create(
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
    Json(req): Json<CreateRoleRequest>,
) -> Result<Json<RoleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let role = state.service.create_role(&query.tenant_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(role))
}

/// GET /v1/roles
pub async fn list(
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
) -> Result<Json<Vec<RoleResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let roles = state.service.list_roles(&query.tenant_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(roles))
}

/// GET /v1/roles/:id
pub async fn get(
    Path(id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
) -> Result<Json<RoleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let role = state.service.get_role(&query.tenant_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(role))
}

/// PATCH /v1/roles/:id
pub async fn update(
    Path(id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
    Json(req): Json<UpdateRoleRequest>,
) -> Result<Json<RoleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let role = state.service.update_role(&query.tenant_id, &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(role))
}

/// DELETE /v1/roles/:id
pub async fn delete(
    Path(id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.delete_role(&query.tenant_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Role deleted.".to_string(),
    }))
}

/// POST /v1/roles/:id/assign
pub async fn assign(
    Path(id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
    Json(req): Json<AssignRoleRequest>,
) -> Result<Json<RoleAssignmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let assignment = state.service.assign_role(&query.tenant_id, &id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(assignment))
}

/// DELETE /v1/roles/:id/assign/:accountId
pub async fn remove_assignment(
    Path((id, account_id)): Path<(String, String)>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_role_assignment(&query.tenant_id, &id, &account_id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Role assignment removed.".to_string(),
    }))
}

/// GET /v1/roles/account/:accountId
pub async fn get_account_roles(
    Path(account_id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
) -> Result<Json<Vec<RoleAssignmentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let roles = state.service.get_account_roles(&query.tenant_id, &account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(roles))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %err, "Internal error");
    let status = if err.to_string().contains("already") {
        StatusCode::CONFLICT
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": err.to_string() })))
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    if err.to_string().contains("not found") {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({ "message": err.to_string() })))
    } else {
        internal_error(err)
    }
}
