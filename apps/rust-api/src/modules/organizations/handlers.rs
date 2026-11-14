//! HTTP handlers for organizations endpoints.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::modules::organizations::dto::{
    BeneficialOwnerResponse, CreateOrganizationRequest, InviteMemberRequest,
    MembershipResponse, OrganizationResponse,
};
use crate::modules::organizations::service::OrganizationsService;

pub struct OrganizationsState {
    pub service: OrganizationsService,
}

fn error_response(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let msg = err.to_string();
    let status = if msg.contains("not found") {
        StatusCode::NOT_FOUND
    } else if msg.contains("must be") {
        StatusCode::BAD_REQUEST
    } else {
        tracing::error!(error = %err, "Internal error");
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": msg })))
}

pub async fn create(
    Path((tenant_id, api_key_id)): Path<(String, String)>,
    State(state): State<Arc<OrganizationsState>>,
    Json(req): Json<CreateOrganizationRequest>,
) -> Result<Json<OrganizationResponse>, (StatusCode, Json<serde_json::Value>)> {
    let org = state.service.create(&tenant_id, &api_key_id, &req).await.map_err(error_response)?;
    Ok(Json(org))
}

pub async fn list_all(
    Path(tenant_id): Path<String>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<Vec<OrganizationResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let orgs = state.service.list_all(&tenant_id).await.map_err(error_response)?;
    Ok(Json(orgs))
}

pub async fn get_by_id(
    Path((tenant_id, org_id)): Path<(String, String)>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<OrganizationResponse>, (StatusCode, Json<serde_json::Value>)> {
    let org = state.service.get_by_id(&tenant_id, &org_id).await.map_err(error_response)?;
    Ok(Json(org))
}

pub async fn list_memberships(
    Path((tenant_id, org_id)): Path<(String, String)>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<Vec<MembershipResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let memberships = state.service.list_memberships(&tenant_id, &org_id).await.map_err(error_response)?;
    Ok(Json(memberships))
}

pub async fn invite_member(
    Path((tenant_id, api_key_id, org_id)): Path<(String, String, String)>,
    State(state): State<Arc<OrganizationsState>>,
    Json(req): Json<InviteMemberRequest>,
) -> Result<Json<MembershipResponse>, (StatusCode, Json<serde_json::Value>)> {
    let role = req.role.as_deref().unwrap_or("MEMBER");
    let membership = state.service.invite_member(&tenant_id, &org_id, &req.phone, role).await.map_err(error_response)?;
    Ok(Json(membership))
}

pub async fn list_beneficial_owners(
    Path((tenant_id, org_id)): Path<(String, String)>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<Vec<BeneficialOwnerResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let owners = state.service.list_beneficial_owners(&tenant_id, &org_id).await.map_err(error_response)?;
    Ok(Json(owners))
}

// ── Account-session endpoints ──

/// GET /v1/organizations/my-memberships/:accountId
pub async fn list_my_memberships(
    Path(account_id): Path<String>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<Vec<OrganizationResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let orgs = state.service.list_my_memberships(&account_id).await.map_err(error_response)?;
    Ok(Json(orgs))
}

/// GET /v1/organizations/invites/mine/:accountId
pub async fn list_my_invites(
    Path(account_id): Path<String>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<Vec<MembershipResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let invites = state.service.list_my_invites(&account_id).await.map_err(error_response)?;
    Ok(Json(invites))
}

/// POST /v1/organizations/invites/:membershipId/accept/:accountId
pub async fn accept_invite(
    Path((membership_id, account_id)): Path<(String, String)>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<MembershipResponse>, (StatusCode, Json<serde_json::Value>)> {
    let membership = state.service.respond_to_invite(&account_id, &membership_id, "ACCEPTED")
        .await.map_err(error_response)?;
    Ok(Json(membership))
}

/// POST /v1/organizations/invites/:membershipId/decline/:accountId
pub async fn decline_invite(
    Path((membership_id, account_id)): Path<(String, String)>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<MembershipResponse>, (StatusCode, Json<serde_json::Value>)> {
    let membership = state.service.respond_to_invite(&account_id, &membership_id, "DECLINED")
        .await.map_err(error_response)?;
    Ok(Json(membership))
}
