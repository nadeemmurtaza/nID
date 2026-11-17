//! HTTP handlers for access control endpoints.
//!
//! Mirrors `apps/api/src/modules/access/access.controller.ts`.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::session::AccountSession;
use crate::core::config::AppEnv;
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
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
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
    account: AccountSession,
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
    Json(req): Json<CreateGrantRequest>,
) -> Result<Json<AccessGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let grant = state.service.create_grant(&account.id, &query.tenant_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(grant))
}

/// GET /v1/access/grants
pub async fn list_grants(
    account: AccountSession,
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
) -> Result<Json<Vec<AccessGrantResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let grants = state.service.list_grants(
        &account.id,
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
    account: AccountSession,
    Path(id): Path<String>,
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
) -> Result<Json<AccessGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let grant = state.service.get_grant(&account.id, &query.tenant_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(grant))
}

/// PATCH /v1/access/grant/:id
pub async fn update_grant(
    account: AccountSession,
    Path(id): Path<String>,
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
    Json(req): Json<UpdateGrantRequest>,
) -> Result<Json<AccessGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let grant = state.service.update_grant(&account.id, &query.tenant_id, &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(grant))
}

/// DELETE /v1/access/grant/:id
pub async fn revoke_grant(
    account: AccountSession,
    Path(id): Path<String>,
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.revoke_grant(&account.id, &query.tenant_id, &id)
        .await
        .map_err(internal_error)?;
    Ok(Json(MessageResponse {
        message: "Grant revoked.".to_string(),
    }))
}

// ── Ownership transfer ──

/// POST /v1/access/transfer-ownership
pub async fn transfer_ownership(
    account: AccountSession,
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
    Json(req): Json<TransferOwnershipRequest>,
) -> Result<Json<AccessGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let grant = state.service.transfer_ownership(&account.id, &query.tenant_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(grant))
}

// ── Partner ──

/// POST /v1/access/partner
pub async fn add_partner(
    account: AccountSession,
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
    Json(req): Json<AddPartnerRequest>,
) -> Result<Json<AccessGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let grant = state.service.add_partner(&account.id, &query.tenant_id, &req.account_id, req.percentage)
        .await
        .map_err(internal_error)?;
    Ok(Json(grant))
}

// ── My permissions ──

/// GET /v1/access/my-permissions
pub async fn get_my_permissions(
    account: AccountSession,
    Query(query): Query<AccessQuery>,
    State(state): State<Arc<AccessState>>,
) -> Result<Json<MyPermissionsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let perms = state.service.get_my_permissions(
        &account.id,
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
    crate::core::error::http_error(err)
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}
