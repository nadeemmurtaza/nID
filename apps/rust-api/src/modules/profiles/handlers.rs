//! Profiles handlers.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::modules::profiles::dto::{ProfileResponse, UpdateProfileRequest};
use crate::modules::profiles::service::ProfilesService;

pub struct ProfilesState {
    pub service: ProfilesService,
}

fn error_response(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let msg = err.to_string();
    let status = if msg.contains("not found") {
        StatusCode::NOT_FOUND
    } else {
        tracing::error!(error = %err, "Internal error");
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": msg })))
}

pub async fn get_by_account(
    Path(account_id): Path<String>,
    State(state): State<Arc<ProfilesState>>,
) -> Result<Json<ProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    let profile = state.service.get_by_account(&account_id).await.map_err(error_response)?;
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
