use newax_accounts::{AccountResponse, AccountsService, VerifyOtpResponse};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.accounts.v1");
}

use proto::{
    accounts_api_service_server::{AccountsApiService as AccountsRpc, AccountsApiServiceServer},
    AccountIdRequest, AccountResponse as ProtoAccountResponse,
    Empty, LoginRequest, RegisterRequest, SessionTokenRequest, StartEmailVerificationRequest,
    StartOtpRequest, VerifyEmailRequest, VerifyOtpRequest,
    VerifyOtpResponse as ProtoVerifyOtpResponse,
};

struct AccountsGrpc {
    service: AccountsService,
    otp_sms_dev_mode: bool,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") {
        Status::not_found(msg)
    } else if msg.contains("incorrect") || msg.contains("expired") || msg.contains("Invalid") {
        Status::invalid_argument(msg)
    } else if msg.contains("Too many") {
        Status::failed_precondition(msg)
    } else if msg.contains("already exists") {
        Status::already_exists(msg)
    } else {
        Status::internal(msg)
    }
}

fn account_to_proto(a: AccountResponse) -> ProtoAccountResponse {
    ProtoAccountResponse {
        id: a.id,
        phone: a.phone,
        email: a.email,
        phone_verified_at: a.phone_verified_at,
        email_verified_at: a.email_verified_at,
        name: a.name,
    }
}

fn verify_otp_to_proto(v: VerifyOtpResponse) -> ProtoVerifyOtpResponse {
    ProtoVerifyOtpResponse {
        session_token: v.session_token,
        account: Some(account_to_proto(v.account)),
    }
}

#[tonic::async_trait]
impl AccountsRpc for AccountsGrpc {
    async fn start_otp(&self, req: Request<StartOtpRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service
            .start_otp(&r.phone, self.otp_sms_dev_mode)
            .await
            .map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn verify_otp(
        &self,
        req: Request<VerifyOtpRequest>,
    ) -> Result<Response<ProtoVerifyOtpResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .verify_otp(&r.phone, &r.code)
            .await
            .map_err(to_status)?;
        Ok(Response::new(verify_otp_to_proto(result)))
    }

    async fn get_account(
        &self,
        req: Request<AccountIdRequest>,
    ) -> Result<Response<ProtoAccountResponse>, Status> {
        let r = req.into_inner();
        let result = self.service.get_account(&r.account_id).await.map_err(to_status)?;
        Ok(Response::new(account_to_proto(result)))
    }

    async fn revoke_session(
        &self,
        req: Request<SessionTokenRequest>,
    ) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service
            .revoke_session(&r.session_token_hash)
            .await
            .map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn revoke_all_sessions(
        &self,
        req: Request<AccountIdRequest>,
    ) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service
            .revoke_all_sessions(&r.account_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn delete_account(
        &self,
        req: Request<AccountIdRequest>,
    ) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service.delete_account(&r.account_id).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn start_email_verification(
        &self,
        req: Request<StartEmailVerificationRequest>,
    ) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service
            .start_email_verification(&r.account_id, &r.email, self.otp_sms_dev_mode)
            .await
            .map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn verify_email(
        &self,
        req: Request<VerifyEmailRequest>,
    ) -> Result<Response<ProtoAccountResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .verify_email(&r.account_id, &r.code)
            .await
            .map_err(to_status)?;
        Ok(Response::new(account_to_proto(result)))
    }

    async fn register(
        &self,
        req: Request<RegisterRequest>,
    ) -> Result<Response<ProtoAccountResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .register(&r.name, &r.email, &r.phone, &r.password)
            .await
            .map_err(to_status)?;
        Ok(Response::new(account_to_proto(result)))
    }

    async fn login(
        &self,
        req: Request<LoginRequest>,
    ) -> Result<Response<ProtoVerifyOtpResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .login(&r.email, &r.password)
            .await
            .map_err(to_status)?;
        Ok(Response::new(verify_otp_to_proto(result)))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_accounts=debug").unwrap())
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("ACCOUNTS_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(50081);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let otp_sms_dev_mode = std::env::var("OTP_SMS_DEV_MODE").ok().map(|v| v == "true").unwrap_or(false);

    let grpc = AccountsGrpc { service: AccountsService::new(pool), otp_sms_dev_mode };

    info!(port, "svc-accounts starting (gRPC)");
    nid_service_auth::server_builder()?
        .add_service(AccountsApiServiceServer::with_interceptor(grpc, nid_service_auth::ServerAuth::from_env(&bind)?))
        .serve(addr)
        .await?;
    Ok(())
}
