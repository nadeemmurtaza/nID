//! HTTP handlers for OAuth endpoints.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::oauth::dto::{
    CreateLoginRequestDto, LoginRequestStatusResponse, TokenExchangeDto, TokenResponse,
};
use crate::modules::oauth::service::OAuthService;

pub struct OAuthState {
    pub service: OAuthService,
    pub env: AppEnv,
}

/// POST /v1/oauth/login-requests
pub async fn create(
    State(state): State<Arc<OAuthState>>,
    Json(req): Json<CreateLoginRequestDto>,
) -> Result<Json<LoginRequestStatusResponse>, (StatusCode, Json<serde_json::Value>)> {
    let status = state.service.create_login_request(&req.client_id, &req.redirect_uri, req.state.as_deref())
        .await
        .map_err(internal_error)?;
    Ok(Json(status))
}

/// GET /v1/oauth/login-requests/:pollToken
pub async fn status(
    Path(poll_token): Path<String>,
    State(state): State<Arc<OAuthState>>,
) -> Result<Json<LoginRequestStatusResponse>, (StatusCode, Json<serde_json::Value>)> {
    let status = state.service.get_status(&poll_token)
        .await
        .map_err(not_found)?;
    Ok(Json(status))
}

/// POST /v1/oauth/login-requests/:pollToken/approve
pub async fn approve(
    Path(poll_token): Path<String>,
    State(state): State<Arc<OAuthState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    state.service.approve(&poll_token, &account_id)
        .await
        .map_err(not_found)?;
    Ok(Json(serde_json::json!({ "message": "Approved" })))
}

/// POST /v1/oauth/login-requests/:pollToken/claim
pub async fn claim(
    Path(poll_token): Path<String>,
    State(state): State<Arc<OAuthState>>,
) -> Result<Json<TokenResponse>, (StatusCode, Json<serde_json::Value>)> {
    let token = state.service.claim(&poll_token)
        .await
        .map_err(not_found)?;
    Ok(Json(token))
}

/// POST /v1/oauth/token
pub async fn token(
    State(state): State<Arc<OAuthState>>,
    Json(req): Json<TokenExchangeDto>,
) -> Result<Json<TokenResponse>, (StatusCode, Json<serde_json::Value>)> {
    let token = state.service.exchange_token(&req.code, &req.client_id, &req.client_secret, &req.redirect_uri)
        .await
        .map_err(internal_error)?;
    Ok(Json(token))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %err, "Internal error");
    let status = if err.to_string().contains("Invalid") {
        StatusCode::UNAUTHORIZED
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
