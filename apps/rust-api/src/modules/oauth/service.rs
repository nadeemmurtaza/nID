//! OAuth service -- gRPC client for `svc-oauth`.
//!
//! Business logic moved to `crates/oauth`, served by
//! `services/oauth` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::oauth::v1::{
    o_auth_api_service_client::OAuthApiServiceClient,
    ApproveRequest, CreateLoginRequestReq, ExchangeTokenRequest,
    LoginRequestStatusResponse as ProtoStatusResponse,
    PollTokenRequest, TokenResponse as ProtoTokenResponse,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::oauth::dto::{LoginRequestStatusResponse, TokenResponse};

pub struct OAuthService {
    #[allow(dead_code)]
    db: DbPool,
    #[allow(dead_code)]
    env: AppEnv,
}

fn status_from_proto(p: ProtoStatusResponse) -> LoginRequestStatusResponse {
    LoginRequestStatusResponse {
        status: p.status,
        approval_url: p.approval_url,
    }
}

fn token_from_proto(p: ProtoTokenResponse) -> TokenResponse {
    TokenResponse {
        access_token: p.access_token,
        token_type: p.token_type,
        expires_in: p.expires_in,
    }
}

async fn client() -> Result<OAuthApiServiceClient<tonic::transport::Channel>> {
    let url = std::env::var("OAUTH_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:50080".to_string());
    OAuthApiServiceClient::connect(url)
        .await
        .map_err(|e| anyhow!("oauth service unreachable: {e}"))
}

impl OAuthService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn create_login_request(
        &self,
        client_id: &str,
        redirect_uri: &str,
        state: Option<&str>,
    ) -> Result<LoginRequestStatusResponse> {
        let mut c = client().await?;
        let resp = c.create_login_request(CreateLoginRequestReq {
            client_id: client_id.to_string(),
            redirect_uri: redirect_uri.to_string(),
            state: state.map(|s| s.to_string()),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(status_from_proto(resp.into_inner()))
    }

    pub async fn get_status(&self, poll_token: &str) -> Result<LoginRequestStatusResponse> {
        let mut c = client().await?;
        let resp = c.get_status(PollTokenRequest {
            poll_token: poll_token.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(status_from_proto(resp.into_inner()))
    }

    pub async fn approve(&self, poll_token: &str, account_id: &str) -> Result<()> {
        let mut c = client().await?;
        c.approve(ApproveRequest {
            poll_token: poll_token.to_string(),
            account_id: account_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn claim(&self, poll_token: &str) -> Result<TokenResponse> {
        let mut c = client().await?;
        let resp = c.claim(PollTokenRequest {
            poll_token: poll_token.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(token_from_proto(resp.into_inner()))
    }

    pub async fn exchange_token(
        &self,
        code: &str,
        client_id: &str,
        client_secret: &str,
        redirect_uri: &str,
    ) -> Result<TokenResponse> {
        let mut c = client().await?;
        let resp = c.exchange_token(ExchangeTokenRequest {
            code: code.to_string(),
            client_id: client_id.to_string(),
            client_secret: client_secret.to_string(),
            redirect_uri: redirect_uri.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(token_from_proto(resp.into_inner()))
    }
}
