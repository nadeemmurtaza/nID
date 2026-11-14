//! HTTP handlers for roles endpoints.
//!
//! Mirrors `apps/api/src/modules/role/role.controller.ts`.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::session::AccountSession;
use crate::core::config::AppEnv;
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
#[serde(rename_all = "camelCase")]
pub struct RolesQuery {
    #[serde(default)]
    pub tenant_id: String,
}

/// POST /v1/roles
pub async fn create(
    account: AccountSession,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
    Json(req): Json<CreateRoleRequest>,
) -> Result<Json<RoleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let role = state.service.create_role(&account.id, &query.tenant_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(role))
}

/// GET /v1/roles
pub async fn list(
    account: AccountSession,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
) -> Result<Json<Vec<RoleResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let roles = state.service.list_roles(&account.id, &query.tenant_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(roles))
}

/// GET /v1/roles/:id
pub async fn get(
    account: AccountSession,
    Path(id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
) -> Result<Json<RoleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let role = state.service.get_role(&account.id, &query.tenant_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(role))
}

/// PATCH /v1/roles/:id
pub async fn update(
    account: AccountSession,
    Path(id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
    Json(req): Json<UpdateRoleRequest>,
) -> Result<Json<RoleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let role = state.service.update_role(&account.id, &query.tenant_id, &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(role))
}

/// DELETE /v1/roles/:id
pub async fn delete(
    account: AccountSession,
    Path(id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.delete_role(&account.id, &query.tenant_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Role deleted.".to_string(),
    }))
}

/// POST /v1/roles/:id/assign
pub async fn assign(
    account: AccountSession,
    Path(id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
    Json(req): Json<AssignRoleRequest>,
) -> Result<Json<RoleAssignmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let assignment = state.service.assign_role(&account.id, &query.tenant_id, &id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(assignment))
}

/// DELETE /v1/roles/:id/assign/:accountId
pub async fn remove_assignment(
    account: AccountSession,
    Path((id, target_account_id)): Path<(String, String)>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_role_assignment(&account.id, &query.tenant_id, &id, &target_account_id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Role assignment removed.".to_string(),
    }))
}

/// GET /v1/roles/account/:accountId
pub async fn get_account_roles(
    account: AccountSession,
    Path(target_account_id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
) -> Result<Json<Vec<RoleAssignmentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let roles = state.service.get_account_roles(&account.id, &query.tenant_id, &target_account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(roles))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let msg = err.to_string();
    let status = if msg.contains("already") {
        StatusCode::CONFLICT
    } else if msg.contains("Only tenant owners") || msg.contains("do not have access") {
        StatusCode::FORBIDDEN
    } else if msg.contains("cannot be modified") || msg.contains("cannot be deleted") {
        StatusCode::BAD_REQUEST
    } else {
        tracing::error!(error = %err, "Internal error");
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": msg })))
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    if err.to_string().contains("not found") {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({ "message": err.to_string() })))
    } else {
        internal_error(err)
    }
}
