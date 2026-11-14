//! HTTP handlers for organizations endpoints.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::api_key::AuthenticatedApiKey;
use crate::core::auth::session::AccountSession;
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

/// POST /v1/organizations
pub async fn create(
    tenant: AuthenticatedApiKey,
    State(state): State<Arc<OrganizationsState>>,
    Json(req): Json<CreateOrganizationRequest>,
) -> Result<Json<OrganizationResponse>, (StatusCode, Json<serde_json::Value>)> {
    let org = state.service.create(&tenant.tenant_id, &tenant.id, &req).await.map_err(error_response)?;
    Ok(Json(org))
}

/// GET /v1/organizations
pub async fn list_all(
    tenant: AuthenticatedApiKey,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<Vec<OrganizationResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let orgs = state.service.list_all(&tenant.tenant_id).await.map_err(error_response)?;
    Ok(Json(orgs))
}

/// GET /v1/organizations/:id
pub async fn get_by_id(
    tenant: AuthenticatedApiKey,
    Path(org_id): Path<String>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<OrganizationResponse>, (StatusCode, Json<serde_json::Value>)> {
    let org = state.service.get_by_id(&tenant.tenant_id, &org_id).await.map_err(error_response)?;
    Ok(Json(org))
}

/// GET /v1/organizations/:id/members
pub async fn list_memberships(
    tenant: AuthenticatedApiKey,
    Path(org_id): Path<String>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<Vec<MembershipResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let memberships = state.service.list_memberships(&tenant.tenant_id, &org_id).await.map_err(error_response)?;
    Ok(Json(memberships))
}

/// POST /v1/organizations/:id/invite
pub async fn invite_member(
    tenant: AuthenticatedApiKey,
    Path(org_id): Path<String>,
    State(state): State<Arc<OrganizationsState>>,
    Json(req): Json<InviteMemberRequest>,
) -> Result<Json<MembershipResponse>, (StatusCode, Json<serde_json::Value>)> {
    let _ = &tenant.tenant_id;
    let role = req.role.as_deref().unwrap_or("MEMBER");
    let membership = state.service.invite_member(&tenant.tenant_id, &org_id, &req.phone, role).await.map_err(error_response)?;
    Ok(Json(membership))
}

/// GET /v1/organizations/:id/members (beneficial owners variant — kept
/// as its own handler since the service call differs)
pub async fn list_beneficial_owners(
    tenant: AuthenticatedApiKey,
    Path(org_id): Path<String>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<Vec<BeneficialOwnerResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let owners = state.service.list_beneficial_owners(&tenant.tenant_id, &org_id).await.map_err(error_response)?;
    Ok(Json(owners))
}

// ── Account-session endpoints ──

/// GET /v1/organizations/my-memberships
pub async fn list_my_memberships(
    account: AccountSession,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<Vec<OrganizationResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let orgs = state.service.list_my_memberships(&account.id).await.map_err(error_response)?;
    Ok(Json(orgs))
}

/// GET /v1/organizations/invites/mine
pub async fn list_my_invites(
    account: AccountSession,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<Vec<MembershipResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let invites = state.service.list_my_invites(&account.id).await.map_err(error_response)?;
    Ok(Json(invites))
}

/// POST /v1/organizations/invites/:membershipId/accept
pub async fn accept_invite(
    account: AccountSession,
    Path(membership_id): Path<String>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<MembershipResponse>, (StatusCode, Json<serde_json::Value>)> {
    let membership = state.service.respond_to_invite(&account.id, &membership_id, "ACCEPTED")
        .await.map_err(error_response)?;
    Ok(Json(membership))
}

/// POST /v1/organizations/invites/:membershipId/decline
pub async fn decline_invite(
    account: AccountSession,
    Path(membership_id): Path<String>,
    State(state): State<Arc<OrganizationsState>>,
) -> Result<Json<MembershipResponse>, (StatusCode, Json<serde_json::Value>)> {
    let membership = state.service.respond_to_invite(&account.id, &membership_id, "DECLINED")
        .await.map_err(error_response)?;
    Ok(Json(membership))
}
