//! HTTP handlers for departments endpoints.
//!
//! Mirrors `apps/api/src/modules/department/department.controller.ts`.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::session::AccountSession;
use crate::core::config::AppEnv;
use crate::modules::departments::dto::{
    AssignDepartmentRequest, CreateDepartmentRequest, DepartmentAssignmentResponse,
    DepartmentResponse, MessageResponse, UpdateDepartmentRequest,
};
use crate::modules::departments::service::DepartmentsService;

pub struct DepartmentsState {
    pub service: DepartmentsService,
    pub env: AppEnv,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepartmentsQuery {
    #[serde(default)]
    pub tenant_id: String,
}

/// POST /v1/departments
pub async fn create(
    account: AccountSession,
    Query(query): Query<DepartmentsQuery>,
    State(state): State<Arc<DepartmentsState>>,
    Json(req): Json<CreateDepartmentRequest>,
) -> Result<Json<DepartmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let dept = state.service.create_department(&account.id, &query.tenant_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(dept))
}

/// GET /v1/departments
pub async fn list(
    account: AccountSession,
    Query(query): Query<DepartmentsQuery>,
    State(state): State<Arc<DepartmentsState>>,
) -> Result<Json<Vec<DepartmentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let depts = state.service.list_departments(&account.id, &query.tenant_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(depts))
}

/// GET /v1/departments/:id
pub async fn get(
    account: AccountSession,
    Path(id): Path<String>,
    Query(query): Query<DepartmentsQuery>,
    State(state): State<Arc<DepartmentsState>>,
) -> Result<Json<DepartmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let dept = state.service.get_department(&account.id, &query.tenant_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(dept))
}

/// PATCH /v1/departments/:id
pub async fn update(
    account: AccountSession,
    Path(id): Path<String>,
    Query(query): Query<DepartmentsQuery>,
    State(state): State<Arc<DepartmentsState>>,
    Json(req): Json<UpdateDepartmentRequest>,
) -> Result<Json<DepartmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let dept = state.service.update_department(&account.id, &query.tenant_id, &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(dept))
}

/// POST /v1/departments/:id/assign
pub async fn assign(
    account: AccountSession,
    Path(id): Path<String>,
    Query(query): Query<DepartmentsQuery>,
    State(state): State<Arc<DepartmentsState>>,
    Json(req): Json<AssignDepartmentRequest>,
) -> Result<Json<DepartmentAssignmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let assignment = state.service.assign_department(&account.id, &query.tenant_id, &id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(assignment))
}

/// DELETE /v1/departments/:id/assign/:accountId
pub async fn remove_assignment(
    account: AccountSession,
    Path((id, target_account_id)): Path<(String, String)>,
    Query(query): Query<DepartmentsQuery>,
    State(state): State<Arc<DepartmentsState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_department_assignment(&account.id, &query.tenant_id, &id, &target_account_id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Department assignment removed.".to_string(),
    }))
}

/// GET /v1/departments/account/:accountId
pub async fn get_account_departments(
    account: AccountSession,
    Path(target_account_id): Path<String>,
    Query(query): Query<DepartmentsQuery>,
    State(state): State<Arc<DepartmentsState>>,
) -> Result<Json<Vec<DepartmentAssignmentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let depts = state.service.get_account_departments(&account.id, &query.tenant_id, &target_account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(depts))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}
