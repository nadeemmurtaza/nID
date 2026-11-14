//! HTTP handlers for invitations endpoints.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
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
pub struct InvitationsQuery {
    #[serde(default)]
    pub tenant_id: String,
    #[serde(default)]
    pub status: Option<String>,
}

/// POST /v1/invitations/email
pub async fn send_email_invite(
    Query(query): Query<InvitationsQuery>,
    State(state): State<Arc<InvitationsState>>,
    Json(req): Json<SendEmailInviteRequest>,
) -> Result<Json<InvitationResponse>, (StatusCode, Json<serde_json::Value>)> {
    let caller_id = "caller".to_string();
    let invite = state.service.send_email_invite(&caller_id, &query.tenant_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(invite))
}

/// POST /v1/invitations/username
pub async fn send_username_invite(
    Query(query): Query<InvitationsQuery>,
    State(state): State<Arc<InvitationsState>>,
    Json(req): Json<SendUsernameInviteRequest>,
) -> Result<Json<InvitationResponse>, (StatusCode, Json<serde_json::Value>)> {
    let caller_id = "caller".to_string();
    let invite = state.service.send_username_invite(&caller_id, &query.tenant_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(invite))
}

/// POST /v1/invitations/accept
pub async fn accept_invitation(
    State(state): State<Arc<InvitationsState>>,
    Json(req): Json<AcceptInvitationRequest>,
) -> Result<Json<InvitationResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let invite = state.service.accept_invitation(&account_id, &req.invitation_id)
        .await
        .map_err(not_found)?;
    Ok(Json(invite))
}

/// GET /v1/invitations
pub async fn list(
    Query(query): Query<InvitationsQuery>,
    State(state): State<Arc<InvitationsState>>,
) -> Result<Json<Vec<InvitationResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let invites = state.service.list_invitations(&query.tenant_id, query.status.as_deref())
        .await
        .map_err(internal_error)?;
    Ok(Json(invites))
}

/// DELETE /v1/invitations/:id
pub async fn revoke(
    Path(id): Path<String>,
    Query(query): Query<InvitationsQuery>,
    State(state): State<Arc<InvitationsState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.revoke_invitation(&query.tenant_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Invitation revoked.".to_string(),
    }))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %err, "Internal error");
    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "message": err.to_string() })))
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    if err.to_string().contains("not found") || err.to_string().contains("expired") {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({ "message": err.to_string() })))
    } else {
        internal_error(err)
    }
}
