//! HTTP handlers for invitations endpoints.
//!
//! Mirrors `apps/api/src/modules/invitation/invitation.controller.ts`.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::session::AccountSession;
use crate::core::config::AppEnv;
use crate::modules::invitations::dto::{
    AcceptInvitationRequest, InvitationResponse, MessageResponse,
    SendEmailInviteRequest, SendUsernameInviteRequest,
};
use crate::modules::invitations::service::InvitationsService;

pub struct InvitationsState {
    pub service: InvitationsService,
    pub env: AppEnv,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct InvitationsQuery {
    #[serde(default)]
    pub tenant_id: String,
    #[serde(default)]
    pub status: Option<String>,
}

/// POST /v1/invitations/email
pub async fn send_email_invite(
    account: AccountSession,
    Query(query): Query<InvitationsQuery>,
    State(state): State<Arc<InvitationsState>>,
    Json(req): Json<SendEmailInviteRequest>,
) -> Result<Json<InvitationResponse>, (StatusCode, Json<serde_json::Value>)> {
    let invite = state.service.send_email_invite(&account.id, &query.tenant_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(invite))
}

/// POST /v1/invitations/username
pub async fn send_username_invite(
    account: AccountSession,
    Query(query): Query<InvitationsQuery>,
    State(state): State<Arc<InvitationsState>>,
    Json(req): Json<SendUsernameInviteRequest>,
) -> Result<Json<InvitationResponse>, (StatusCode, Json<serde_json::Value>)> {
    let invite = state.service.send_username_invite(&account.id, &query.tenant_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(invite))
}

/// POST /v1/invitations/accept
pub async fn accept_invitation(
    account: AccountSession,
    State(state): State<Arc<InvitationsState>>,
    Json(req): Json<AcceptInvitationRequest>,
) -> Result<Json<InvitationResponse>, (StatusCode, Json<serde_json::Value>)> {
    let invite = state.service.accept_invitation(&account.id, &req.invitation_id)
        .await
        .map_err(not_found)?;
    Ok(Json(invite))
}

/// GET /v1/invitations
pub async fn list(
    account: AccountSession,
    Query(query): Query<InvitationsQuery>,
    State(state): State<Arc<InvitationsState>>,
) -> Result<Json<Vec<InvitationResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let invites = state.service.list_invitations(&account.id, &query.tenant_id, query.status.as_deref())
        .await
        .map_err(internal_error)?;
    Ok(Json(invites))
}

/// DELETE /v1/invitations/:id
pub async fn revoke(
    account: AccountSession,
    Path(id): Path<String>,
    Query(query): Query<InvitationsQuery>,
    State(state): State<Arc<InvitationsState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.revoke_invitation(&account.id, &query.tenant_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Invitation revoked.".to_string(),
    }))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}
