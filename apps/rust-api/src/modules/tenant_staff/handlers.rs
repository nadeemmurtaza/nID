//! HTTP handlers for tenant staff endpoints.

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::tenant_staff::dto::{InviteStaffRequest, StaffMemberResponse};
use crate::modules::tenant_staff::service::TenantStaffService;

pub struct TenantStaffState {
    pub service: TenantStaffService,
    pub env: AppEnv,
}

/// POST /v1/tenant-staff
pub async fn invite(
    State(state): State<Arc<TenantStaffState>>,
    Json(req): Json<InviteStaffRequest>,
) -> Result<Json<StaffMemberResponse>, (StatusCode, Json<serde_json::Value>)> {
    let tenant_id = "tenant".to_string();
    let api_key_id = "key".to_string();
    let staff = state.service.invite(&tenant_id, &api_key_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(staff))
}

/// GET /v1/tenant-staff
pub async fn list(
    State(state): State<Arc<TenantStaffState>>,
) -> Result<Json<Vec<StaffMemberResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let tenant_id = "tenant".to_string();
    let api_key_id = "key".to_string();
    let staff = state.service.list(&tenant_id, &api_key_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(staff))
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
