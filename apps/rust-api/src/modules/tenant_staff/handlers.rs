//! HTTP handlers for tenant staff endpoints.

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::api_key::AuthenticatedApiKey;
use crate::core::config::AppEnv;
use crate::modules::tenant_staff::dto::{InviteStaffRequest, StaffMemberResponse};
use crate::modules::tenant_staff::service::TenantStaffService;

pub struct TenantStaffState {
    pub service: TenantStaffService,
    pub env: AppEnv,
}

/// POST /v1/tenant-staff
pub async fn invite(
    tenant: AuthenticatedApiKey,
    State(state): State<Arc<TenantStaffState>>,
    Json(req): Json<InviteStaffRequest>,
) -> Result<Json<StaffMemberResponse>, (StatusCode, Json<serde_json::Value>)> {
    let staff = state.service.invite(&tenant.tenant_id, &tenant.id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(staff))
}

/// GET /v1/tenant-staff
pub async fn list(
    tenant: AuthenticatedApiKey,
    State(state): State<Arc<TenantStaffState>>,
) -> Result<Json<Vec<StaffMemberResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let staff = state.service.list(&tenant.tenant_id, &tenant.id)
        .await
        .map_err(internal_error)?;
    Ok(Json(staff))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}
