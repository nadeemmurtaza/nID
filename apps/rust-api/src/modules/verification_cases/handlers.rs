//! HTTP handlers for verification cases endpoints.
//!
//! Mirrors `apps/api/src/modules/verification-cases/verification-cases.controller.ts`.
//!
//! KNOWN GAP (not fixed here, flagged instead): the TS controller also exposes
//! `submitDocument`, `submitLiveness`, and `submitClaimDocument` (multipart file
//! uploads under ApiKeyGuard). The Rust `VerificationCasesService` has no
//! equivalent methods yet, so those three endpoints are still missing entirely
//! — this is a missing-feature gap, not an auth-wiring bug, and is out of scope
//! for this pass.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::api_key::AuthenticatedApiKey;
use crate::core::auth::tenant_actor::AuthenticatedActor;
use crate::modules::verification_cases::dto::{
    CreatedCaseResponse, MessageResponse, ResolveCaseRequest, SubmitAgentAttestationRequest,
    SubmitCodeRequest, SubmitLocationRequest, SubmitOtpRequest, SubmitSelfReportRequest,
    VerificationCaseResponse, VerificationCaseWithAttempts, VerificationCaseWithSubject,
};
use crate::modules::verification_cases::service::VerificationCasesService;

/// Shared state for verification cases handlers
pub struct VerificationCasesState {
    pub service: VerificationCasesService,
}

/// POST /v1/verification-cases
pub async fn create(
    tenant: AuthenticatedApiKey,
    State(state): State<Arc<VerificationCasesState>>,
    Json(req): Json<crate::modules::verification_cases::dto::CreateVerificationCaseRequest>,
) -> Result<Json<CreatedCaseResponse>, (StatusCode, Json<serde_json::Value>)> {
    let case = state
        .service
        .create(&tenant.tenant_id, &tenant.id, &req)
        .await
        .map_err(error_response)?;
    Ok(Json(case))
}

/// GET /v1/verification-cases
pub async fn list(
    actor: AuthenticatedActor,
    State(state): State<Arc<VerificationCasesState>>,
) -> Result<Json<Vec<VerificationCaseWithSubject>>, (StatusCode, Json<serde_json::Value>)> {
    let cases = state
        .service
        .list(&actor.tenant_id, actor.actor_type, &actor.actor_id)
        .await
        .map_err(error_response)?;
    Ok(Json(cases))
}

/// GET /v1/verification-cases/:id
pub async fn get_by_id(
    actor: AuthenticatedActor,
    Path(case_id): Path<String>,
    State(state): State<Arc<VerificationCasesState>>,
) -> Result<Json<VerificationCaseWithAttempts>, (StatusCode, Json<serde_json::Value>)> {
    let case = state
        .service
        .get_by_id(&actor.tenant_id, actor.actor_type, &actor.actor_id, &case_id)
        .await
        .map_err(error_response)?;
    Ok(Json(case))
}

/// POST /v1/verification-cases/:id/resolve
pub async fn resolve(
    actor: AuthenticatedActor,
    Path(case_id): Path<String>,
    State(state): State<Arc<VerificationCasesState>>,
    Json(req): Json<ResolveCaseRequest>,
) -> Result<Json<VerificationCaseResponse>, (StatusCode, Json<serde_json::Value>)> {
    let case = state
        .service
        .resolve_case(
            &actor.tenant_id,
            actor.actor_type,
            &actor.actor_id,
            &case_id,
            &req.decision,
            req.reason.as_deref(),
        )
        .await
        .map_err(error_response)?;
    Ok(Json(case))
}

/// POST /v1/verification-cases/:id/otp/submit
pub async fn submit_otp(
    tenant: AuthenticatedApiKey,
    Path(case_id): Path<String>,
    State(state): State<Arc<VerificationCasesState>>,
    Json(req): Json<SubmitOtpRequest>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let resp = state
        .service
        .submit_otp_code(&tenant.tenant_id, &tenant.id, &case_id, &req.code)
        .await
        .map_err(error_response)?;
    Ok(Json(resp))
}

/// POST /v1/verification-cases/:id/claims/:method/report
pub async fn submit_self_report(
    tenant: AuthenticatedApiKey,
    Path((case_id, method)): Path<(String, String)>,
    State(state): State<Arc<VerificationCasesState>>,
    Json(req): Json<SubmitSelfReportRequest>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let resp = state
        .service
        .submit_self_report(
            &tenant.tenant_id,
            &tenant.id,
            &case_id,
            &method,
            &req.reported_value,
        )
        .await
        .map_err(error_response)?;
    Ok(Json(resp))
}

/// POST /v1/verification-cases/:id/claims/:method/agent-attest
pub async fn submit_agent_attestation(
    tenant: AuthenticatedApiKey,
    Path((case_id, method)): Path<(String, String)>,
    State(state): State<Arc<VerificationCasesState>>,
    Json(req): Json<SubmitAgentAttestationRequest>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let resp = state
        .service
        .submit_agent_attestation(
            &tenant.tenant_id,
            &tenant.id,
            &case_id,
            &method,
            &req.decision,
            req.notes.as_deref(),
        )
        .await
        .map_err(error_response)?;
    Ok(Json(resp))
}

/// POST /v1/verification-cases/:id/claims/:method/code
pub async fn submit_code(
    tenant: AuthenticatedApiKey,
    Path((case_id, method)): Path<(String, String)>,
    State(state): State<Arc<VerificationCasesState>>,
    Json(req): Json<SubmitCodeRequest>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let resp = state
        .service
        .submit_code(&tenant.tenant_id, &tenant.id, &case_id, &method, &req.code)
        .await
        .map_err(error_response)?;
    Ok(Json(resp))
}

/// POST /v1/verification-cases/:id/claims/:method/location
pub async fn submit_location(
    tenant: AuthenticatedApiKey,
    Path((case_id, method)): Path<(String, String)>,
    State(state): State<Arc<VerificationCasesState>>,
    Json(req): Json<SubmitLocationRequest>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let resp = state
        .service
        .submit_location(
            &tenant.tenant_id,
            &tenant.id,
            &case_id,
            &method,
            req.latitude,
            req.longitude,
        )
        .await
        .map_err(error_response)?;
    Ok(Json(resp))
}

/// Convert anyhow error to HTTP error response
fn error_response(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let msg = err.to_string();
    let status = if msg.contains("not found") {
        StatusCode::NOT_FOUND
    } else if msg.contains("must be") || msg.contains("requires") || msg.contains("has no") {
        StatusCode::BAD_REQUEST
    } else {
        tracing::error!(error = %err, "Internal error");
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": msg })))
}
