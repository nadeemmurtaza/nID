//! HTTP handlers for subjects endpoints.
//!
//! Mirrors `apps/api/src/modules/subjects/subjects.controller.ts`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::db::DbPool;
use crate::core::config::AppEnv;
use crate::modules::subjects::dto::{
    AttributeBadgesResponse, BadgesResponse, CreateSubjectRequest, SubjectResponse,
};
use crate::modules::subjects::service::SubjectsService;

/// Shared state for subjects handlers
pub struct SubjectsState {
    pub service: SubjectsService,
}

/// POST /v1/subjects
pub async fn create(
    Path((tenant_id, api_key_id)): Path<(String, String)>,
    State(state): State<Arc<SubjectsState>>,
    Json(req): Json<CreateSubjectRequest>,
) -> Result<Json<SubjectResponse>, (StatusCode, Json<serde_json::Value>)> {
    let subject = state
        .service
        .create(&tenant_id, &api_key_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(subject))
}

/// GET /v1/subjects/:id
pub async fn get_by_id(
    Path((tenant_id, api_key_id, subject_id)): Path<(String, String, String)>,
    State(state): State<Arc<SubjectsState>>,
) -> Result<Json<SubjectResponse>, (StatusCode, Json<serde_json::Value>)> {
    let subject = state
        .service
        .get_by_id(&tenant_id, &api_key_id, &subject_id)
        .await
        .map_err(not_found_or_error)?;
    Ok(Json(subject))
}

/// GET /v1/subjects/:id/badges
pub async fn get_badges(
    Path((tenant_id, actor_type, actor_id, subject_id)): Path<(String, String, String, String)>,
    State(state): State<Arc<SubjectsState>>,
) -> Result<Json<BadgesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let badges = state
        .service
        .get_badges(&tenant_id, &actor_type, &actor_id, &subject_id)
        .await
        .map_err(not_found_or_error)?;
    Ok(Json(badges))
}

/// GET /v1/subjects/:id/attribute-badges
pub async fn get_attribute_badges(
    Path((tenant_id, actor_type, actor_id, subject_id)): Path<(String, String, String, String)>,
    State(state): State<Arc<SubjectsState>>,
) -> Result<Json<AttributeBadgesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let badges = state
        .service
        .get_attribute_badges(&tenant_id, &actor_type, &actor_id, &subject_id)
        .await
        .map_err(not_found_or_error)?;
    Ok(Json(badges))
}

/// Convert anyhow error to HTTP error response
fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %err, "Internal error");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "message": err.to_string() })),
    )
}

/// Convert anyhow error to HTTP error response (404 for not found)
fn not_found_or_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let msg = err.to_string();
    let status = if msg.contains("not found") {
        StatusCode::NOT_FOUND
    } else {
        tracing::error!(error = %err, "Internal error");
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": msg })))
}
