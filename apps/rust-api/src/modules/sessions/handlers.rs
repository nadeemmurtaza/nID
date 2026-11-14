//! Sessions handlers — subject-facing verification session endpoints.
//!
//! Mirrors `apps/api/src/modules/sessions/sessions.controller.ts`.

use axum::extract::{Path, State, Json as AxumJson, Multipart};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::upload::{read_single_file, read_multiple_files};
use crate::modules::sessions::dto::{
    AcceptedResponse, SessionStatusResponse, SubmitCodeRequest, SubmitLocationRequest,
    SubmitOtpRequest, SubmitSelfReportRequest,
};
use crate::modules::sessions::service::SessionsService;

pub struct SessionsState {
    pub service: SessionsService,
}

fn error_response(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let msg = err.to_string();
    let status = if msg.contains("not found")
        || msg.contains("Invalid")
        || msg.contains("expired")
        || msg.contains("invalid")
        || msg.contains("no longer")
        || msg.contains("not a")
    {
        StatusCode::BAD_REQUEST
    } else {
        tracing::error!(error = %err, "Internal error");
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": msg })))
}

/// GET /v1/sessions/:token/status
pub async fn get_status(
    Path(token): Path<String>,
    State(state): State<Arc<SessionsState>>,
) -> Result<Json<SessionStatusResponse>, (StatusCode, Json<serde_json::Value>)> {
    let status = state.service.get_status(&token).await.map_err(error_response)?;
    Ok(Json(status))
}

/// POST /v1/sessions/:token/otp/submit
pub async fn submit_otp(
    Path(token): Path<String>,
    State(state): State<Arc<SessionsState>>,
    AxumJson(body): AxumJson<SubmitOtpRequest>,
) -> Result<Json<AcceptedResponse>, (StatusCode, Json<serde_json::Value>)> {
    let result = state.service.submit_otp(&token, &body.code).await.map_err(error_response)?;
    Ok(Json(result))
}

/// POST /v1/sessions/:token/document/submit
pub async fn submit_document(
    Path(token): Path<String>,
    State(state): State<Arc<SessionsState>>,
    multipart: Multipart,
) -> Result<Json<AcceptedResponse>, (StatusCode, Json<serde_json::Value>)> {
    let file = read_single_file(multipart, "file").await.map_err(error_response)?;
    let result = state.service.submit_document(&token, file).await.map_err(error_response)?;
    Ok(Json(result))
}

/// POST /v1/sessions/:token/liveness/submit
pub async fn submit_liveness(
    Path(token): Path<String>,
    State(state): State<Arc<SessionsState>>,
    multipart: Multipart,
) -> Result<Json<AcceptedResponse>, (StatusCode, Json<serde_json::Value>)> {
    let files = read_multiple_files(multipart, "frames", 120 * 1024 * 1024).await.map_err(error_response)?;
    let result = state.service.submit_liveness(&token, files).await.map_err(error_response)?;
    Ok(Json(result))
}

/// POST /v1/sessions/:token/claims/:method/submit
pub async fn submit_claim_document(
    Path((token, method)): Path<(String, String)>,
    State(state): State<Arc<SessionsState>>,
    multipart: Multipart,
) -> Result<Json<AcceptedResponse>, (StatusCode, Json<serde_json::Value>)> {
    let file = read_single_file(multipart, "file").await.map_err(error_response)?;
    let result = state
        .service
        .submit_claim_document(&token, &method, file)
        .await
        .map_err(error_response)?;
    Ok(Json(result))
}

/// POST /v1/sessions/:token/claims/:method/report
pub async fn submit_self_report(
    Path((token, method)): Path<(String, String)>,
    State(state): State<Arc<SessionsState>>,
    AxumJson(body): AxumJson<SubmitSelfReportRequest>,
) -> Result<Json<AcceptedResponse>, (StatusCode, Json<serde_json::Value>)> {
    let result = state
        .service
        .submit_self_report(&token, &method, &body.reported_value)
        .await
        .map_err(error_response)?;
    Ok(Json(result))
}

/// POST /v1/sessions/:token/claims/:method/code
pub async fn submit_code(
    Path((token, method)): Path<(String, String)>,
    State(state): State<Arc<SessionsState>>,
    AxumJson(body): AxumJson<SubmitCodeRequest>,
) -> Result<Json<AcceptedResponse>, (StatusCode, Json<serde_json::Value>)> {
    let result = state
        .service
        .submit_code(&token, &method, &body.code)
        .await
        .map_err(error_response)?;
    Ok(Json(result))
}

/// POST /v1/sessions/:token/claims/:method/location
pub async fn submit_location(
    Path((token, method)): Path<(String, String)>,
    State(state): State<Arc<SessionsState>>,
    AxumJson(body): AxumJson<SubmitLocationRequest>,
) -> Result<Json<AcceptedResponse>, (StatusCode, Json<serde_json::Value>)> {
    let result = state
        .service
        .submit_location(&token, &method, body.latitude, body.longitude)
        .await
        .map_err(error_response)?;
    Ok(Json(result))
}
