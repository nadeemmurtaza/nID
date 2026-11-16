use newax_invitations::{
    InvitationResponse as LogicInvitationResponse, InvitationsService, SendEmailInviteRequest as LogicSendEmailRequest,
    SendUsernameInviteRequest as LogicSendUsernameRequest,
};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.invitations.v1");
}

use proto::{
    invitations_service_server::{InvitationsService as InvitationsRpc, InvitationsServiceServer},
    AcceptInvitationRequest, Empty, InvitationResponse, InvitationsResponse, ListInvitationsRequest,
    RevokeInvitationRequest, SendEmailInviteRequest, SendUsernameInviteRequest,
};

struct Grpc {
    service: InvitationsService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("already exists") {
        Status::already_exists(msg)
    } else if msg.contains("Only tenant owners") || msg.contains("do not have access") {
        Status::permission_denied(msg)
    } else if msg.contains("not found") || msg.contains("No account found") {
        Status::not_found(msg)
    } else if msg.contains("expired") || msg.contains("no longer pending") || msg.contains("not for your account") {
        Status::invalid_argument(msg)
    } else {
        Status::internal(msg)
    }
}

fn invite_to_proto(i: LogicInvitationResponse) -> InvitationResponse {
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

#[tonic::async_trait]
impl InvitationsRpc for Grpc {
    async fn send_email_invite(&self, req: Request<SendEmailInviteRequest>) -> Result<Response<InvitationResponse>, Status> {
        let r = req.into_inner();
        let logic_req = LogicSendEmailRequest {
            email: r.email,
            organization_id: r.organization_id,
            brand_id: r.brand_id,
            role_definition_id: r.role_definition_id,
            department_id: r.department_id,
            scope: r.scope,
        };
        let invite = self.service.send_email_invite(&r.caller_id, &r.tenant_id, &logic_req).await.map_err(to_status)?;
        Ok(Response::new(invite_to_proto(invite)))
    }

    async fn send_username_invite(&self, req: Request<SendUsernameInviteRequest>) -> Result<Response<InvitationResponse>, Status> {
        let r = req.into_inner();
        let logic_req = LogicSendUsernameRequest {
            username: r.username,
            organization_id: r.organization_id,
            brand_id: r.brand_id,
            role_definition_id: r.role_definition_id,
            department_id: r.department_id,
            scope: r.scope,
        };
        let invite = self.service.send_username_invite(&r.caller_id, &r.tenant_id, &logic_req).await.map_err(to_status)?;
        Ok(Response::new(invite_to_proto(invite)))
    }

    async fn accept_invitation(&self, req: Request<AcceptInvitationRequest>) -> Result<Response<InvitationResponse>, Status> {
        let r = req.into_inner();
        let invite = self.service.accept_invitation(&r.account_id, &r.invitation_id).await.map_err(to_status)?;
        Ok(Response::new(invite_to_proto(invite)))
    }

    async fn list_invitations(&self, req: Request<ListInvitationsRequest>) -> Result<Response<InvitationsResponse>, Status> {
        let r = req.into_inner();
        let invites = self
            .service
            .list_invitations(&r.caller_id, &r.tenant_id, r.status.as_deref())
            .await
            .map_err(to_status)?;
        Ok(Response::new(InvitationsResponse { invitations: invites.into_iter().map(invite_to_proto).collect() }))
    }

    async fn revoke_invitation(&self, req: Request<RevokeInvitationRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service.revoke_invitation(&r.caller_id, &r.tenant_id, &r.invitation_id).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_invitations=debug").unwrap())
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("INVITATIONS_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(50079);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let grpc = Grpc { service: InvitationsService::new(pool) };

    info!(port, "svc-invitations starting (gRPC)");
    Server::builder()
        .add_service(InvitationsServiceServer::new(grpc))
        .serve(addr)
        .await?;
    Ok(())
}
