use newax_oauth::{LoginRequestStatusResponse, OAuthService, TokenResponse};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.oauth.v1");
}

use proto::{
    o_auth_api_service_server::{OAuthApiService as OAuthRpc, OAuthApiServiceServer},
    ApproveRequest, CreateLoginRequestReq, Empty, ExchangeTokenRequest,
    LoginRequestStatusResponse as ProtoStatusResponse,
    PollTokenRequest, TokenResponse as ProtoTokenResponse,
};

struct OAuthGrpc {
    service: OAuthService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") {
        Status::not_found(msg)
    } else if msg.contains("Invalid") {
        Status::invalid_argument(msg)
    } else {
        Status::internal(msg)
    }
}

fn status_to_proto(s: LoginRequestStatusResponse) -> ProtoStatusResponse {
    ProtoStatusResponse {
        status: s.status,
        approval_url: s.approval_url,
    }
}

fn token_to_proto(t: TokenResponse) -> ProtoTokenResponse {
    ProtoTokenResponse {
        access_token: t.access_token,
        token_type: t.token_type,
        expires_in: t.expires_in,
    }
}

#[tonic::async_trait]
impl OAuthRpc for OAuthGrpc {
    async fn create_login_request(
        &self,
        req: Request<CreateLoginRequestReq>,
    ) -> Result<Response<ProtoStatusResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .create_login_request(
                &r.client_id,
                &r.redirect_uri,
                r.state.as_deref(),
            )
            .await
            .map_err(to_status)?;
        Ok(Response::new(status_to_proto(result)))
    }

    async fn get_status(
        &self,
        req: Request<PollTokenRequest>,
    ) -> Result<Response<ProtoStatusResponse>, Status> {
        let r = req.into_inner();
        let result = self.service.get_status(&r.poll_token).await.map_err(to_status)?;
        Ok(Response::new(status_to_proto(result)))
    }

    async fn approve(&self, req: Request<ApproveRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service
            .approve(&r.poll_token, &r.account_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn claim(
        &self,
        req: Request<PollTokenRequest>,
    ) -> Result<Response<ProtoTokenResponse>, Status> {
        let r = req.into_inner();
        let result = self.service.claim(&r.poll_token).await.map_err(to_status)?;
        Ok(Response::new(token_to_proto(result)))
    }

    async fn exchange_token(
        &self,
        req: Request<ExchangeTokenRequest>,
    ) -> Result<Response<ProtoTokenResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .exchange_token(&r.code, &r.client_id, &r.client_secret, &r.redirect_uri)
            .await
            .map_err(to_status)?;
        Ok(Response::new(token_to_proto(result)))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_oauth=debug").unwrap())
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("OAUTH_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(50080);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let grpc = OAuthGrpc { service: OAuthService::new(pool) };

    info!(port, "svc-oauth starting (gRPC)");
    nid_service_auth::server_builder()?
        .add_service(OAuthApiServiceServer::with_interceptor(grpc, nid_service_auth::ServerAuth::from_env(&bind)?))
        .serve(addr)
        .await?;
    Ok(())
}
