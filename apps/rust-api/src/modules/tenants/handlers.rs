//! HTTP handlers for tenants endpoints.
//!
//! Mirrors `apps/api/src/modules/tenants/tenants.controller.ts`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::tenants::dto::{
    ApiKeyResponse, CreatedTenantResponse, CreateApiKeyRequest, CreateTenantRequest,
    InviteStaffRequest, MessageResponse, NewApiKeyResponse, StaffMemberResponse,
    TenantMembership, TenantResponse, TenantSelfResponse, TenantWithCounts, UpdateTenantRequest,
};
use crate::modules::tenants::service::TenantsService;

/// Shared state for tenants handlers
pub struct TenantsState {
    pub service: TenantsService,
    pub env: AppEnv,
}

// ── Tenant-self endpoint ──

/// GET /v1/tenants/me
pub async fn get_self(
    Path((tenant_id, actor_type)): Path<(String, String)>,
    State(state): State<Arc<TenantsState>>,
) -> Result<Json<TenantSelfResponse>, (StatusCode, Json<serde_json::Value>)> {
    let tenant = state.service.get_self(&tenant_id, &actor_type)
        .await
        .map_err(internal_error)?;
    Ok(Json(tenant))
}

// ── Account-session endpoint ──

/// GET /v1/tenants/my-memberships
pub async fn get_my_memberships(
    Path(account_id): Path<String>,
    State(state): State<Arc<TenantsState>>,
) -> Result<Json<Vec<TenantMembership>>, (StatusCode, Json<serde_json::Value>)> {
    let memberships = state.service.get_memberships_for_account(&account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(memberships))
}

// ── Platform-admin endpoints ──

/// POST /v1/tenants
pub async fn create(
    State(state): State<Arc<TenantsState>>,
    Json(req): Json<CreateTenantRequest>,
) -> Result<Json<CreatedTenantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let tenant = state.service.create(
        &req.name, &req.slug,
        req.data_residency_region.as_deref(),
        req.webhook_url.as_deref(),
        req.billing_webhook_url.as_deref(),
        req.initial_staff_account_id.as_deref(),
    )
    .await
    .map_err(internal_error)?;
    Ok(Json(tenant))
}

/// GET /v1/tenants
pub async fn list_all(
    State(state): State<Arc<TenantsState>>,
) -> Result<Json<Vec<TenantWithCounts>>, (StatusCode, Json<serde_json::Value>)> {
    let tenants = state.service.list_all()
        .await
        .map_err(internal_error)?;
    Ok(Json(tenants))
}

/// GET /v1/tenants/:id
pub async fn get_by_id(
    Path(id): Path<String>,
    State(state): State<Arc<TenantsState>>,
) -> Result<Json<TenantWithCounts>, (StatusCode, Json<serde_json::Value>)> {
    let tenant = state.service.get_by_id(&id)
        .await
        .map_err(not_found)?;
    Ok(Json(tenant))
}

/// PUT /v1/tenants/:id
pub async fn update(
    Path(id): Path<String>,
    State(state): State<Arc<TenantsState>>,
    Json(req): Json<UpdateTenantRequest>,
) -> Result<Json<TenantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let tenant = state.service.update(
        &id,
        req.name.as_deref(),
        req.data_residency_region.as_deref(),
        req.webhook_url.map(|s| s.map(|s| s.as_str())),
        req.billing_webhook_url.map(|s| s.map(|s| s.as_str())),
    )
    .await
    .map_err(not_found)?;
    Ok(Json(tenant))
}

// ── Tenant-admin endpoints (API keys) ──

/// POST /v1/tenants/:id/api-keys
pub async fn create_api_key(
    Path(id): Path<String>,
    State(state): State<Arc<TenantsState>>,
    Json(req): Json<CreateApiKeyRequest>,
) -> Result<Json<NewApiKeyResponse>, (StatusCode, Json<serde_json::Value>)> {
    let key = state.service.create_api_key(&id, req.scopes, req.rate_limit_per_minute)
        .await
        .map_err(not_found)?;
    Ok(Json(key))
}

/// GET /v1/tenants/:id/api-keys
pub async fn list_api_keys(
    Path(id): Path<String>,
    State(state): State<Arc<TenantsState>>,
) -> Result<Json<Vec<ApiKeyResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let keys = state.service.list_api_keys(&id)
        .await
        .map_err(internal_error)?;
    Ok(Json(keys))
}

/// DELETE /v1/tenants/:id/api-keys/:apiKeyId
pub async fn revoke_api_key(
    Path((id, api_key_id)): Path<(String, String)>,
    State(state): State<Arc<TenantsState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.revoke_api_key(&id, &api_key_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(MessageResponse {
        message: "API key revoked.".to_string(),
    }))
}

// ── Tenant-admin endpoints (staff) ──

/// POST /v1/tenants/:id/staff
pub async fn invite_staff(
    Path(id): Path<String>,
    State(state): State<Arc<TenantsState>>,
    Json(req): Json<InviteStaffRequest>,
) -> Result<Json<StaffMemberResponse>, (StatusCode, Json<serde_json::Value>)> {
    let staff = state.service.invite_staff(&id, &req.account_id, &req.role)
        .await
        .map_err(internal_error)?;
    Ok(Json(staff))
}

/// GET /v1/tenants/:id/staff
pub async fn list_staff(
    Path(id): Path<String>,
    State(state): State<Arc<TenantsState>>,
) -> Result<Json<Vec<StaffMemberResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let staff = state.service.list_staff(&id)
        .await
        .map_err(internal_error)?;
    Ok(Json(staff))
}

/// DELETE /v1/tenants/:id/staff/:accountId
pub async fn remove_staff(
    Path((id, account_id)): Path<(String, String)>,
    State(state): State<Arc<TenantsState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_staff(&id, &account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(MessageResponse {
        message: "Staff member removed.".to_string(),
    }))
}

// ── Error helpers ──

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %err, "Internal error");
    let status = if err.to_string().contains("already exists") || err.to_string().contains("already a staff") {
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
