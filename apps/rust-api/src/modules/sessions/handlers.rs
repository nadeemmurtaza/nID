//! Sessions handlers.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::modules::sessions::dto::SessionStatusResponse;
use crate::modules::sessions::service::SessionsService;

pub struct SessionsState {
    pub service: SessionsService,
}

fn error_response(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let msg = err.to_string();
    let status = if msg.contains("not found") || msg.contains("Invalid") || msg.contains("expired") {
        StatusCode::NOT_FOUND
    } else {
        tracing::error!(error = %err, "Internal error");
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": msg })))
}

pub async fn get_status(
    Path(token): Path<String>,
    State(state): State<Arc<SessionsState>>,
) -> Result<Json<SessionStatusResponse>, (StatusCode, Json<serde_json::Value>)> {
    let status = state.service.get_status(&token).await.map_err(error_response)?;
    Ok(Json(status))
}
