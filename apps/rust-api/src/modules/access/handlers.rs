//! HTTP handlers for access control endpoints.
//!
//! Mirrors `apps/api/src/modules/access/access.controller.ts`.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use std::collections::HashMap;
use std::sync::Arc;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::access::dto::{
    AccessGrantResponse, AddPartnerRequest, CreateGrantRequest, MessageResponse,
    MyPermissionsResponse, TransferOwnershipRequest, UpdateGrantRequest,
};
use crate::modules::access::service::AccessService;

/// Shared state for access handlers
pub struct AccessState {
    pub service: AccessService,
    pub env: AppEnv,
}

/// Query parameters for access endpoints
#[derive(Debug, serde::Deserialize)]
pub struct AccessQuery {
    #[serde(default)]
    pub tenant_id: String,
    #[serde(default)]
    pub organization_id: Option<String>,
    #[serde(default)]
    pub brand_id: Option<String>,
}

// ── Grant endpoints ──

/// POST /v1/access/grant
pub async fn create_grant(
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
    Json(req): Json<CreateGrantRequest>,
) -> Result<Json<AccessGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    // The caller_id comes from the session extractor in a real setup;
    // for now we use a placeholder — the account-session guard would inject it.
    let caller_id = req.account_id.clone(); // In real usage, from AccountSession extractor
    let grant = state.service.create_grant(&caller_id, &query.tenant_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(grant))
}

/// GET /v1/access/grants
pub async fn list_grants(
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
) -> Result<Json<Vec<AccessGrantResponse>>, (StatusCode, Json<serde_json::Value>)> {
    // caller_id would come from AccountSession extractor
    let caller_id = "caller".to_string();
    let grants = state.service.list_grants(
        &caller_id,
        &query.tenant_id,
        query.organization_id.as_deref(),
        query.brand_id.as_deref(),
    )
    .await
    .map_err(internal_error)?;
    Ok(Json(grants))
}

/// GET /v1/access/grant/:id
pub async fn get_grant(
    Path(id): Path<String>,
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
) -> Result<Json<AccessGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let caller_id = "caller".to_string();
    let grant = state.service.get_grant(&caller_id, &query.tenant_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(grant))
}

/// PATCH /v1/access/grant/:id
pub async fn update_grant(
    Path(id): Path<String>,
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
    Json(req): Json<UpdateGrantRequest>,
) -> Result<Json<AccessGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let caller_id = "caller".to_string();
    let grant = state.service.update_grant(&caller_id, &query.tenant_id, &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(grant))
}

/// DELETE /v1/access/grant/:id
pub async fn revoke_grant(
    Path(id): Path<String>,
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let caller_id = "caller".to_string();
    state.service.revoke_grant(&caller_id, &query.tenant_id, &id)
        .await
        .map_err(internal_error)?;
    Ok(Json(MessageResponse {
        message: "Grant revoked.".to_string(),
    }))
}

// ── Ownership transfer ──

/// POST /v1/access/transfer-ownership
pub async fn transfer_ownership(
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
    Json(req): Json<TransferOwnershipRequest>,
) -> Result<Json<AccessGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let caller_id = "caller".to_string();
    let grant = state.service.transfer_ownership(&caller_id, &query.tenant_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(grant))
}

// ── Partner ──

/// POST /v1/access/partner
pub async fn add_partner(
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
    Json(req): Json<AddPartnerRequest>,
) -> Result<Json<AccessGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let caller_id = "caller".to_string();
    let grant = state.service.add_partner(&caller_id, &query.tenant_id, &req.account_id, req.percentage)
        .await
        .map_err(internal_error)?;
    Ok(Json(grant))
}

// ── My permissions ──

/// GET /v1/access/my-permissions
pub async fn get_my_permissions(
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
) -> Result<Json<MyPermissionsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let perms = state.service.get_my_permissions(
        &account_id,
        &query.tenant_id,
        query.organization_id.as_deref(),
        query.brand_id.as_deref(),
    )
    .await
    .map_err(internal_error)?;
    Ok(Json(perms))
}

// ── Error helpers ──

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %err, "Internal error");
    let status = if err.to_string().contains("already") || err.to_string().contains("Only tenant owners") {
        if err.to_string().contains("already") {
            StatusCode::CONFLICT
        } else {
            StatusCode::FORBIDDEN
        }
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
