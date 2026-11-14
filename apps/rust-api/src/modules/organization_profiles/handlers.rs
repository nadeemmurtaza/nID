//! Organization Profiles handlers — org-owned profile management endpoints.
//!
//! Mirrors `apps/api/src/modules/profiles/organization-profiles.controller.ts`.

use axum::extract::{Path, State, Json as AxumJson};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::modules::organization_profiles::dto::{
    CreateOrgGrantRequest, CreateOrgProfileRequest, OrgProfileFieldGrantResponse,
    OrgProfileResponse, UpdateOrgProfileRequest,
};
use crate::modules::organization_profiles::service::OrganizationProfilesService;

pub struct OrganizationProfilesState {
    pub service: OrganizationProfilesService,
    pub env: AppEnv,
}

use crate::core::config::AppEnv;

fn error_response(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let msg = err.to_string();
    let status = if msg.contains("not found")
        || msg.contains("not authorized")
        || msg.contains("must be verified")
        || msg.contains("not exist")
    {
        StatusCode::NOT_FOUND
    } else if msg.contains("already exists") || msg.contains("conflict") {
        StatusCode::CONFLICT
    } else {
        tracing::error!(error = %err, "Internal error");
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": msg })))
}

/// POST /v1/organizations/:id/profile
pub async fn create(
    Path(organization_id): Path<String>,
    State(state): State<Arc<OrganizationProfilesState>>,
    AxumJson(body): AxumJson<CreateOrgProfileRequest>,
) -> Result<Json<OrgProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Account ID would come from the session extractor in production
    let account_id = String::from("TODO-session-extractor");
    let profile = state
        .service
        .create_for_organization(&account_id, &organization_id, &body)
        .await
        .map_err(error_response)?;
    Ok(Json(profile))
}

/// GET /v1/organizations/:id/profile
pub async fn get(
    Path(organization_id): Path<String>,
    State(state): State<Arc<OrganizationProfilesState>>,
) -> Result<Json<OrgProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = String::from("TODO-session-extractor");
    let profile = state
        .service
        .get_for_organization(&account_id, &organization_id)
        .await
        .map_err(error_response)?;
    Ok(Json(profile))
}

/// PATCH /v1/organizations/:id/profile
pub async fn update(
    Path(organization_id): Path<String>,
    State(state): State<Arc<OrganizationProfilesState>>,
    AxumJson(body): AxumJson<UpdateOrgProfileRequest>,
) -> Result<Json<OrgProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = String::from("TODO-session-extractor");
    let profile = state
        .service
        .update_for_organization(&account_id, &organization_id, &body)
        .await
        .map_err(error_response)?;
    Ok(Json(profile))
}

/// POST /v1/organizations/:id/profile/grants
pub async fn create_grant(
    Path(organization_id): Path<String>,
    State(state): State<Arc<OrganizationProfilesState>>,
    AxumJson(body): AxumJson<CreateOrgGrantRequest>,
) -> Result<Json<OrgProfileFieldGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = String::from("TODO-session-extractor");
    let grant = state
        .service
        .create_grant_for_organization(&account_id, &organization_id, &body)
        .await
        .map_err(error_response)?;
    Ok(Json(grant))
}

/// GET /v1/organizations/:id/profile/grants
pub async fn list_grants(
    Path(organization_id): Path<String>,
    State(state): State<Arc<OrganizationProfilesState>>,
) -> Result<Json<Vec<OrgProfileFieldGrantResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = String::from("TODO-session-extractor");
    let grants = state
        .service
        .list_grants_for_organization(&account_id, &organization_id)
        .await
        .map_err(error_response)?;
    Ok(Json(grants))
}

/// DELETE /v1/organizations/:id/profile/grants/:grantId
pub async fn revoke_grant(
    Path((organization_id, grant_id)): Path<(String, String)>,
    State(state): State<Arc<OrganizationProfilesState>>,
) -> Result<Json<OrgProfileFieldGrantResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = String::from("TODO-session-extractor");
    let grant = state
        .service
        .revoke_grant_for_organization(&account_id, &organization_id, &grant_id)
        .await
        .map_err(error_response)?;
    Ok(Json(grant))
}
