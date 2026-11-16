//! Invitations service -- gRPC client for `svc-invitations`.
//!
//! Business logic moved to `crates/invitations`, served by
//! `services/invitations` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::invitations::v1::{
    invitations_service_client::InvitationsServiceClient, AcceptInvitationRequest as GrpcAcceptRequest,
    ListInvitationsRequest, RevokeInvitationRequest as GrpcRevokeRequest, SendEmailInviteRequest as GrpcSendEmailRequest,
    SendUsernameInviteRequest as GrpcSendUsernameRequest,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::invitations::dto::{InvitationResponse, SendEmailInviteRequest, SendUsernameInviteRequest};

pub struct InvitationsService {
    #[allow(dead_code)]
    db: DbPool,
    #[allow(dead_code)]
    env: AppEnv,
}

fn invite_from_proto(i: newax_proto::invitations::v1::InvitationResponse) -> InvitationResponse {
    InvitationResponse {
        id: i.id,
        tenant_id: i.tenant_id,
        email: i.email,
        username: i.username,
        invited_by: i.invited_by,
        organization_id: i.organization_id,
        brand_id: i.brand_id,
        scope: i.scope,
        role_definition_id: i.role_definition_id,
        department_id: i.department_id,
        status: i.status,
        expires_at: i.expires_at,
        accepted_at: i.accepted_at,
        created_at: i.created_at,
    }
}

async fn client() -> Result<InvitationsServiceClient<nid_service_auth::AuthedChannel>> {
    let url = std::env::var("INVITATIONS_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:50079".to_string());
    nid_service_auth::connect(url).await.map(InvitationsServiceClient::new).map_err(|e| anyhow!("invitations service unreachable: {e}"))
}

impl InvitationsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn send_email_invite(
        &self,
        caller_id: &str,
        tenant_id: &str,
        req: &SendEmailInviteRequest,
    ) -> Result<InvitationResponse> {
        let mut c = client().await?;
        let resp = c
            .send_email_invite(GrpcSendEmailRequest {
                caller_id: caller_id.to_string(),
                tenant_id: tenant_id.to_string(),
                email: req.email.clone(),
                organization_id: req.organization_id.clone(),
                brand_id: req.brand_id.clone(),
                role_definition_id: req.role_definition_id.clone(),
                department_id: req.department_id.clone(),
                scope: req.scope.clone(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(invite_from_proto(resp.into_inner()))
    }

    pub async fn send_username_invite(
        &self,
        caller_id: &str,
        tenant_id: &str,
        req: &SendUsernameInviteRequest,
    ) -> Result<InvitationResponse> {
        let mut c = client().await?;
        let resp = c
            .send_username_invite(GrpcSendUsernameRequest {
                caller_id: caller_id.to_string(),
                tenant_id: tenant_id.to_string(),
                username: req.username.clone(),
                organization_id: req.organization_id.clone(),
                brand_id: req.brand_id.clone(),
                role_definition_id: req.role_definition_id.clone(),
                department_id: req.department_id.clone(),
                scope: req.scope.clone(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(invite_from_proto(resp.into_inner()))
    }

    pub async fn accept_invitation(
        &self,
        account_id: &str,
        invitation_id: &str,
    ) -> Result<InvitationResponse> {
        let mut c = client().await?;
        let resp = c
            .accept_invitation(GrpcAcceptRequest { account_id: account_id.to_string(), invitation_id: invitation_id.to_string() })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(invite_from_proto(resp.into_inner()))
    }

    pub async fn list_invitations(
        &self,
        caller_id: &str,
        tenant_id: &str,
        status: Option<&str>,
    ) -> Result<Vec<InvitationResponse>> {
        let mut c = client().await?;
        let resp = c
            .list_invitations(ListInvitationsRequest {
                caller_id: caller_id.to_string(),
                tenant_id: tenant_id.to_string(),
                status: status.map(|s| s.to_string()),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().invitations.into_iter().map(invite_from_proto).collect())
    }

    pub async fn revoke_invitation(&self, caller_id: &str, tenant_id: &str, invitation_id: &str) -> Result<()> {
        let mut c = client().await?;
        c.revoke_invitation(GrpcRevokeRequest {
            caller_id: caller_id.to_string(),
            tenant_id: tenant_id.to_string(),
            invitation_id: invitation_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }
}
