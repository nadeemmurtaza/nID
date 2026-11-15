use newax_account_verification::{AccountVerificationService, VerificationCaseResponse as LogicCaseResponse};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.account_verification.v1");
}

use proto::{
    account_verification_service_server::{AccountVerificationService as AccountVerificationRpc, AccountVerificationServiceServer},
    AccountIdRequest, BadgeEntry as ProtoBadge, CaseIdRequest, CreateCaseRequest, VerificationCaseResponse as ProtoCaseResponse,
    VerificationCasesResponse, VerificationStatusResponse as ProtoStatusResponse,
};

struct Grpc {
    service: AccountVerificationService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") {
        Status::not_found(msg)
    } else {
        Status::internal(msg)
    }
}

fn case_to_proto(c: LogicCaseResponse) -> ProtoCaseResponse {
    ProtoCaseResponse {
        id: c.id,
        subject_id: c.subject_id,
        claim_type: c.claim_type,
        level: c.level,
        status: c.status,
        created_at: c.created_at,
        resolved_at: c.resolved_at,
    }
}

#[tonic::async_trait]
impl AccountVerificationRpc for Grpc {
    async fn get_status(&self, req: Request<AccountIdRequest>) -> Result<Response<ProtoStatusResponse>, Status> {
        let account_id = req.into_inner().account_id;
        let status = self.service.get_status(&account_id).await.map_err(to_status)?;
        Ok(Response::new(ProtoStatusResponse {
            account_id: status.account_id,
            badges: status
                .badges
                .into_iter()
                .map(|b| ProtoBadge { claim_type: b.claim_type, level: b.level, verified_at: b.verified_at })
                .collect(),
        }))
    }

    async fn create_case(&self, req: Request<CreateCaseRequest>) -> Result<Response<ProtoCaseResponse>, Status> {
        let r = req.into_inner();
        let case = self
            .service
            .create_case(&r.account_id, &r.claim_type, r.level.as_deref())
            .await
            .map_err(to_status)?;
        Ok(Response::new(case_to_proto(case)))
    }

    async fn list_cases(&self, req: Request<AccountIdRequest>) -> Result<Response<VerificationCasesResponse>, Status> {
        let account_id = req.into_inner().account_id;
        let cases = self.service.list_cases(&account_id).await.map_err(to_status)?;
        Ok(Response::new(VerificationCasesResponse { cases: cases.into_iter().map(case_to_proto).collect() }))
    }

    async fn get_case(&self, req: Request<CaseIdRequest>) -> Result<Response<ProtoCaseResponse>, Status> {
        let r = req.into_inner();
        let case = self.service.get_case(&r.account_id, &r.case_id).await.map_err(to_status)?;
        Ok(Response::new(case_to_proto(case)))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_account_verification=debug").unwrap())
        .init();

    let database_url = std::env::var("APP_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .map_err(|_| "APP_DATABASE_URL (or DATABASE_URL) must be set")?;
    let pool = PgPoolOptions::new().max_connections(5).connect(&database_url).await?;

    let port: u16 = std::env::var("ACCOUNT_VERIFICATION_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(50075);
    let addr = format!("0.0.0.0:{port}").parse()?;

    let grpc = Grpc { service: AccountVerificationService::new(pool) };

    info!(port, "svc-account-verification starting (gRPC)");
    Server::builder()
        .add_service(AccountVerificationServiceServer::new(grpc))
        .serve(addr)
        .await?;
    Ok(())
}
