//! HTTP handlers for roles endpoints.
//!
//! Mirrors `apps/api/src/modules/role/role.controller.ts`.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::{Extension, Json};
use std::sync::Arc;

use crate::core::audit::{log_admin_action, AuditActorType};
use crate::core::db::DbPool;

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
#[serde(deny_unknown_fields)]
pub struct RolesQuery {
    #[serde(default)]
    pub tenant_id: String,
}

/// POST /v1/roles
pub async fn create(
    account: AccountSession,
    Extension(db): Extension<DbPool>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
    Json(req): Json<CreateRoleRequest>,
) -> Result<Json<RoleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let role = state.service.create_role(&account.id, &query.tenant_id, &req)
        .await
        .map_err(internal_error)?;
    log_admin_action(&db, &query.tenant_id, AuditActorType::Account, &account.id, "role.create", serde_json::json!({ "roleId": role.id })).await;
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
    Extension(db): Extension<DbPool>,
    Path(id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
    Json(req): Json<UpdateRoleRequest>,
) -> Result<Json<RoleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let role = state.service.update_role(&account.id, &query.tenant_id, &id, &req)
        .await
        .map_err(not_found)?;
    log_admin_action(&db, &query.tenant_id, AuditActorType::Account, &account.id, "role.update", serde_json::json!({ "roleId": id })).await;
    Ok(Json(role))
}

/// DELETE /v1/roles/:id
pub async fn delete(
    account: AccountSession,
    Extension(db): Extension<DbPool>,
    Path(id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.delete_role(&account.id, &query.tenant_id, &id)
        .await
        .map_err(not_found)?;
    log_admin_action(&db, &query.tenant_id, AuditActorType::Account, &account.id, "role.delete", serde_json::json!({ "roleId": id })).await;
    Ok(Json(MessageResponse {
        message: "Role deleted.".to_string(),
    }))
}

/// POST /v1/roles/:id/assign
pub async fn assign(
    account: AccountSession,
    Extension(db): Extension<DbPool>,
    Path(id): Path<String>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
    Json(req): Json<AssignRoleRequest>,
) -> Result<Json<RoleAssignmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let assignment = state.service.assign_role(&account.id, &query.tenant_id, &id, &req)
        .await
        .map_err(internal_error)?;
    log_admin_action(&db, &query.tenant_id, AuditActorType::Account, &account.id, "role.assign", serde_json::json!({ "roleId": id, "targetAccountId": req.account_id })).await;
    Ok(Json(assignment))
}

/// DELETE /v1/roles/:id/assign/:accountId
pub async fn remove_assignment(
    account: AccountSession,
    Extension(db): Extension<DbPool>,
    Path((id, target_account_id)): Path<(String, String)>,
    Query(query): Query<RolesQuery>,
    State(state): State<Arc<RolesState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_role_assignment(&account.id, &query.tenant_id, &id, &target_account_id)
        .await
        .map_err(not_found)?;
    log_admin_action(&db, &query.tenant_id, AuditActorType::Account, &account.id, "role.unassign", serde_json::json!({ "roleId": id, "targetAccountId": target_account_id })).await;
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
    crate::core::error::http_error(err)
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}
