//! Profiles handlers — full profile management endpoints.
//!
//! Mirrors `apps/api/src/modules/profiles/profiles.controller.ts`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::session::{AccountSession, OptionalAccountSession};
use crate::modules::profiles::dto::{
    CreateGrantRequest, CreateProfileRequest, ProfileFieldGrantResponse,
    ProfileResponse, PublicProfileResponse, UpdateProfileRequest,
};
use crate::modules::profiles::service::ProfilesService;

pub struct ProfilesState {
    pub service: ProfilesService,
}

fn error_response(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let msg = err.to_string();
    let status = if msg.contains("not found") || msg.contains("No profile") || msg.contains("No published") || msg.contains("No such grant") || msg.contains("No account") {
        StatusCode::NOT_FOUND
    } else if msg.contains("already has") || msg.contains("already taken") {
        StatusCode::CONFLICT
    } else if msg.contains("Verify") || msg.contains("permanent") || msg.contains("required") {
        StatusCode::FORBIDDEN
    } else if msg.contains("must be based") || msg.contains("reserved") || msg.contains("Cannot grant") {
        StatusCode::BAD_REQUEST
    } else {
        tracing::error!(error = %err, "Internal error");
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": msg })))
}

/// POST /v1/profiles
pub async fn create(
    account: AccountSession,
    State(state): State<Arc<ProfilesState>>,
    Json(req): Json<CreateProfileRequest>,
) -> Result<Json<ProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    let profile = state.service.create(&account.id, &req).await.map_err(error_response)?;
    Ok(Json(profile))
}

/// GET /v1/profiles/me
pub async fn get_mine(
    account: AccountSession,
    State(state): State<Arc<ProfilesState>>,
) -> Result<Json<ProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    let profile = state.service.get_mine(&account.id).await.map_err(error_response)?;
    Ok(Json(profile))
}

/// PATCH /v1/profiles/me
pub async fn update(
    account: AccountSession,
    State(state): State<Arc<ProfilesState>>,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<ProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    let profile = state.service.update(&account.id, &req).await.map_err(error_response)?;
    Ok(Json(profile))
}

/// GET /v1/profiles/:slug — public, but OptionalAccountSession lets an
/// authenticated viewer see fields granted directly to them.
pub async fn get_public_by_slug(
    OptionalAccountSession(viewer): OptionalAccountSession,
    Path(slug): Path<String>,
    State(state): State<Arc<ProfilesState>>,
) -> Result<Json<PublicProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    let viewer_id = viewer.as_ref().map(|a| a.id.as_str());
    let profile = state.service.get_public_by_slug(&slug, viewer_id).await.map_err(error_response)?;
    Ok(Json(profile))
}

/// POST /v1/profiles/me/grants
pub async fn create_grant(
    account: AccountSession,
    State(state): State<Arc<ProfilesState>>,
    Json(req): Json<CreateGrantRequest>,
) -> Result<Json<ProfileFieldGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let grant = state.service.create_grant(&account.id, &req).await.map_err(error_response)?;
    Ok(Json(grant))
}

/// GET /v1/profiles/me/grants
pub async fn list_grants(
    account: AccountSession,
    State(state): State<Arc<ProfilesState>>,
) -> Result<Json<Vec<ProfileFieldGrantResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let grants = state.service.list_grants(&account.id).await.map_err(error_response)?;
    Ok(Json(grants))
}

/// DELETE /v1/profiles/me/grants/:id
pub async fn revoke_grant(
    account: AccountSession,
    Path(grant_id): Path<String>,
    State(state): State<Arc<ProfilesState>>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    state.service.revoke_grant(&account.id, &grant_id).await.map_err(error_response)?;
    Ok(StatusCode::OK)
}
