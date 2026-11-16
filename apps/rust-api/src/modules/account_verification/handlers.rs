//! HTTP handlers for account verification endpoints.
//!
//! Mirrors `apps/api/src/modules/account-verification/account-verification.controller.ts`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::session::AccountSession;
use crate::core::config::AppEnv;
use crate::modules::account_verification::dto::{
    CreateSelfVerificationCaseRequest, VerificationCaseResponse, VerificationStatusResponse,
};
use crate::modules::account_verification::service::AccountVerificationService;

pub struct AccountVerificationState {
    pub service: AccountVerificationService,
    pub env: AppEnv,
}

/// GET /v1/accounts/me/verification
pub async fn get_status(
    account: AccountSession,
    State(state): State<Arc<AccountVerificationState>>,
) -> Result<Json<VerificationStatusResponse>, (StatusCode, Json<serde_json::Value>)> {
    let status = state.service.get_status(&account.id)
        .await
        .map_err(internal_error)?;
    Ok(Json(status))
}

/// POST /v1/accounts/me/verification/cases
pub async fn create_case(
    account: AccountSession,
    State(state): State<Arc<AccountVerificationState>>,
    Json(req): Json<CreateSelfVerificationCaseRequest>,
) -> Result<Json<VerificationCaseResponse>, (StatusCode, Json<serde_json::Value>)> {
    let case = state.service.create_case(&account.id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(case))
}

/// GET /v1/accounts/me/verification/cases
pub async fn list_cases(
    account: AccountSession,
    State(state): State<Arc<AccountVerificationState>>,
) -> Result<Json<Vec<VerificationCaseResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let cases = state.service.list_cases(&account.id)
        .await
        .map_err(internal_error)?;
    Ok(Json(cases))
}

/// GET /v1/accounts/me/verification/cases/:id
pub async fn get_case(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<AccountVerificationState>>,
) -> Result<Json<VerificationCaseResponse>, (StatusCode, Json<serde_json::Value>)> {
    let case = state.service.get_case(&account.id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(case))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}
