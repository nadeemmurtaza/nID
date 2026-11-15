//! HTTP handlers for accounts endpoints.
//!
//! Mirrors `apps/api/src/modules/accounts/accounts.controller.ts`.

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::session::AccountSession;
use crate::modules::accounts::dto::{
    AcceptedResponse, AccountResponse, StartOtpRequest, VerifyOtpRequest, VerifyOtpResponse,
    StartEmailVerificationRequest, VerifyEmailRequest,
};
use crate::modules::accounts::service::AccountsService;

/// Shared state for accounts handlers
pub struct AccountsState {
    pub service: AccountsService,
}

/// POST /v1/accounts/otp/start
pub async fn start_otp(
    State(state): State<Arc<AccountsState>>,
    Json(req): Json<StartOtpRequest>,
) -> Result<Json<AcceptedResponse>, (StatusCode, Json<serde_json::Value>)> {
    state
        .service
        .start_otp(&req.phone)
        .await
        .map_err(internal_error)?;
    Ok(Json(AcceptedResponse { accepted: true }))
}

/// POST /v1/accounts/otp/verify
pub async fn verify_otp(
    State(state): State<Arc<AccountsState>>,
    Json(req): Json<VerifyOtpRequest>,
) -> Result<Json<VerifyOtpResponse>, (StatusCode, Json<serde_json::Value>)> {
    let response = state
        .service
        .verify_otp(&req.phone, &req.code)
        .await
        .map_err(internal_error)?;
    Ok(Json(response))
}

/// GET /v1/accounts/me
pub async fn me(
    account: AccountSession,
    State(state): State<Arc<AccountsState>>,
) -> Result<Json<AccountResponse>, (StatusCode, Json<serde_json::Value>)> {
    let acct = state
        .service
        .get_account(&account.id)
        .await
        .map_err(internal_error)?;
    Ok(Json(acct.into()))
}

/// POST /v1/accounts/me/logout — revokes only this one session.
pub async fn logout(
    account: AccountSession,
    State(state): State<Arc<AccountsState>>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    state
        .service
        .revoke_session(&account.session_token_hash)
        .await
        .map_err(internal_error)?;
    Ok(StatusCode::NO_CONTENT)
}

/// POST /v1/accounts/me/logout-all — revokes every session on this account.
pub async fn logout_all(
    account: AccountSession,
    State(state): State<Arc<AccountsState>>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    state
        .service
        .revoke_all_sessions(&account.id)
        .await
        .map_err(internal_error)?;
    Ok(StatusCode::NO_CONTENT)
}

/// POST /v1/accounts/me/email/start
pub async fn start_email_verification(
    account: AccountSession,
    State(state): State<Arc<AccountsState>>,
    Json(req): Json<StartEmailVerificationRequest>,
) -> Result<Json<AcceptedResponse>, (StatusCode, Json<serde_json::Value>)> {
    state
        .service
        .start_email_verification(&account.id, &req.email)
        .await
        .map_err(internal_error)?;
    Ok(Json(AcceptedResponse { accepted: true }))
}

/// POST /v1/accounts/me/email/verify
pub async fn verify_email(
    account: AccountSession,
    State(state): State<Arc<AccountsState>>,
    Json(req): Json<VerifyEmailRequest>,
) -> Result<Json<AccountResponse>, (StatusCode, Json<serde_json::Value>)> {
    let acct = state
        .service
        .verify_email(&account.id, &req.code)
        .await
        .map_err(internal_error)?;
    Ok(Json(acct))
}

/// DELETE /v1/accounts/me — COMPLIANCE_AND_ACCESSIBILITY_RULES.md §8: data deletion request
pub async fn delete_account(
    account: AccountSession,
    State(state): State<Arc<AccountsState>>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    state
        .service
        .delete_account(&account.id)
        .await
        .map_err(internal_error)?;
    Ok(StatusCode::NO_CONTENT)
}

/// Convert anyhow error to HTTP error response
fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %err, "Internal error");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "message": err.to_string() })),
    )
}
