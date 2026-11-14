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
    let msg = err.to_string();
    let status = if msg.contains("already exists") {
        StatusCode::BAD_REQUEST
    } else if msg.contains("Only tenant owners") || msg.contains("do not have access") {
        StatusCode::FORBIDDEN
    } else if msg.contains("No account found") {
        StatusCode::NOT_FOUND
    } else {
        tracing::error!(error = %err, "Internal error");
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": msg })))
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let msg = err.to_string();
    if msg.contains("not found") {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({ "message": msg })))
    } else if msg.contains("expired") || msg.contains("no longer pending") || msg.contains("not for your account") || msg.contains("Only pending") {
        (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "message": msg })))
    } else {
        internal_error(err)
    }
}
