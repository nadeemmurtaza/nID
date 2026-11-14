//! HTTP handlers for account verification endpoints.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
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
    State(state): State<Arc<AccountVerificationState>>,
) -> Result<Json<VerificationStatusResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let status = state.service.get_status(&account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(status))
}

/// POST /v1/accounts/me/verification/cases
pub async fn create_case(
    State(state): State<Arc<AccountVerificationState>>,
    Json(req): Json<CreateSelfVerificationCaseRequest>,
) -> Result<Json<VerificationCaseResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let case = state.service.create_case(&account_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(case))
}

/// GET /v1/accounts/me/verification/cases
pub async fn list_cases(
    State(state): State<Arc<AccountVerificationState>>,
) -> Result<Json<Vec<VerificationCaseResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let cases = state.service.list_cases(&account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(cases))
}

/// GET /v1/accounts/me/verification/cases/:id
pub async fn get_case(
    Path(id): Path<String>,
    State(state): State<Arc<AccountVerificationState>>,
) -> Result<Json<VerificationCaseResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let case = state.service.get_case(&account_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(case))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %err, "Internal error");
    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "message": err.to_string() })))
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    if err.to_string().contains("not found") {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({ "message": err.to_string() })))
    } else {
        internal_error(err)
    }
}
