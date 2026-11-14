//! Profiles handlers — full profile management endpoints.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::modules::profiles::dto::{
    BadgeEntry, CreateGrantRequest, CreateProfileRequest, ProfileFieldGrantResponse,
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

pub async fn create(
    Path(account_id): Path<String>,
    State(state): State<Arc<ProfilesState>>,
    Json(req): Json<CreateProfileRequest>,
) -> Result<Json<ProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    let profile = state.service.create(&account_id, &req).await.map_err(error_response)?;
    Ok(Json(profile))
}

pub async fn get_mine(
    Path(account_id): Path<String>,
    State(state): State<Arc<ProfilesState>>,
) -> Result<Json<ProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    let profile = state.service.get_mine(&account_id).await.map_err(error_response)?;
    Ok(Json(profile))
}

pub async fn update(
    Path(account_id): Path<String>,
    State(state): State<Arc<ProfilesState>>,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<ProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    let profile = state.service.update(&account_id, &req).await.map_err(error_response)?;
    Ok(Json(profile))
}

pub async fn get_public_by_slug(
    Path(slug): Path<String>,
    State(state): State<Arc<ProfilesState>>,
) -> Result<Json<PublicProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    let profile = state.service.get_public_by_slug(&slug, None).await.map_err(error_response)?;
    Ok(Json(profile))
}

pub async fn create_grant(
    Path(account_id): Path<String>,
    State(state): State<Arc<ProfilesState>>,
    Json(req): Json<CreateGrantRequest>,
) -> Result<Json<ProfileFieldGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let grant = state.service.create_grant(&account_id, &req).await.map_err(error_response)?;
    Ok(Json(grant))
}

pub async fn list_grants(
    Path(account_id): Path<String>,
    State(state): State<Arc<ProfilesState>>,
) -> Result<Json<Vec<ProfileFieldGrantResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let grants = state.service.list_grants(&account_id).await.map_err(error_response)?;
    Ok(Json(grants))
}

pub async fn revoke_grant(
    Path((account_id, grant_id)): Path<(String, String)>,
    State(state): State<Arc<ProfilesState>>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    state.service.revoke_grant(&account_id, &grant_id).await.map_err(error_response)?;
    Ok(StatusCode::OK)
}

pub async fn get_badges(
    Path(account_id): Path<String>,
    State(state): State<Arc<ProfilesState>>,
) -> Result<Json<Vec<BadgeEntry>>, (StatusCode, Json<serde_json::Value>)> {
    let badges = state.service.get_badges(&account_id).await.map_err(error_response)?;
    Ok(Json(badges))
}
