//! HTTP handlers for subjects endpoints.
//!
//! Mirrors `apps/api/src/modules/subjects/subjects.controller.ts`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::api_key::AuthenticatedApiKey;
use crate::core::auth::tenant_actor::AuthenticatedActor;
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
    tenant: AuthenticatedApiKey,
    State(state): State<Arc<SubjectsState>>,
    Json(req): Json<CreateSubjectRequest>,
) -> Result<Json<SubjectResponse>, (StatusCode, Json<serde_json::Value>)> {
    let subject = state
        .service
        .create(&tenant.tenant_id, &tenant.id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(subject))
}

/// GET /v1/subjects/:id
pub async fn get_by_id(
    tenant: AuthenticatedApiKey,
    Path(subject_id): Path<String>,
    State(state): State<Arc<SubjectsState>>,
) -> Result<Json<SubjectResponse>, (StatusCode, Json<serde_json::Value>)> {
    let subject = state
        .service
        .get_by_id(&tenant.tenant_id, &tenant.id, &subject_id)
        .await
        .map_err(not_found_or_error)?;
    Ok(Json(subject))
}

/// GET /v1/subjects/:id/badges
pub async fn get_badges(
    actor: AuthenticatedActor,
    Path(subject_id): Path<String>,
    State(state): State<Arc<SubjectsState>>,
) -> Result<Json<BadgesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let badges = state
        .service
        .get_badges(&actor.tenant_id, actor.actor_type, &actor.actor_id, &subject_id)
        .await
        .map_err(not_found_or_error)?;
    Ok(Json(badges))
}

/// GET /v1/subjects/:id/attribute-badges
pub async fn get_attribute_badges(
    actor: AuthenticatedActor,
    Path(subject_id): Path<String>,
    State(state): State<Arc<SubjectsState>>,
) -> Result<Json<AttributeBadgesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let badges = state
        .service
        .get_attribute_badges(&actor.tenant_id, actor.actor_type, &actor.actor_id, &subject_id)
        .await
        .map_err(not_found_or_error)?;
    Ok(Json(badges))
}

/// Convert anyhow error to HTTP error response
fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}

/// Convert anyhow error to HTTP error response (404 for not found)
fn not_found_or_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}
