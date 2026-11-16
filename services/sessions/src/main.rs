use newax_sessions::{
    AcceptedResponse, AttemptEntry, SessionStatusResponse, SessionsService, UploadedFile,
};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.sessions.v1");
}

use proto::{
    sessions_api_service_server::{SessionsApiService as SessionsRpc, SessionsApiServiceServer},
    AcceptedResponse as ProtoAcceptedResponse,
    AttemptEntry as ProtoAttemptEntry, SessionStatusResponse as ProtoSessionStatusResponse,
    SubmitClaimDocumentRequest, SubmitCodeRequest, SubmitDocumentRequest, SubmitLocationRequest,
    SubmitLivenessRequest, SubmitOtpRequest, SubmitSelfReportRequest, TokenRequest,
};

struct SessionsGrpc {
    service: SessionsService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") || msg.contains("invalid") || msg.contains("expired") {
        Status::not_found(msg)
    } else if msg.contains("not a") {
        Status::invalid_argument(msg)
    } else {
        Status::internal(msg)
    }
}

fn status_to_proto(s: SessionStatusResponse) -> ProtoSessionStatusResponse {
    ProtoSessionStatusResponse {
        case_id: s.case_id,
        status: s.status,
        claim_type: s.claim_type,
        level: s.level,
        resolved_at: s.resolved_at,
        attempts: s
            .attempts
            .into_iter()
            .map(|a| ProtoAttemptEntry {
                method: a.method,
                status: a.status,
            })
            .collect(),
        phone: s.phone,
    }
}

fn file_from_proto(
    data: Vec<u8>,
    filename: String,
    content_type: String,
) -> UploadedFile {
    UploadedFile {
        buffer: data,
        filename,
        content_type,
    }
}

#[tonic::async_trait]
impl SessionsRpc for SessionsGrpc {
    async fn get_status(
        &self,
        req: Request<TokenRequest>,
    ) -> Result<Response<ProtoSessionStatusResponse>, Status> {
        let r = req.into_inner();
        let result = self.service.get_status(&r.token).await.map_err(to_status)?;
        Ok(Response::new(status_to_proto(result)))
    }

    async fn submit_otp(
        &self,
        req: Request<SubmitOtpRequest>,
    ) -> Result<Response<ProtoAcceptedResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .submit_otp(&r.token, &r.code)
            .await
            .map_err(to_status)?;
        Ok(Response::new(ProtoAcceptedResponse {
            accepted: result.accepted,
        }))
    }

    async fn submit_document(
        &self,
        req: Request<SubmitDocumentRequest>,
    ) -> Result<Response<ProtoAcceptedResponse>, Status> {
        let r = req.into_inner();
        let file = file_from_proto(r.file_data, r.file_name, r.content_type);
        let result = self
            .service
            .submit_document(&r.token, file)
            .await
            .map_err(to_status)?;
        Ok(Response::new(ProtoAcceptedResponse {
            accepted: result.accepted,
        }))
    }

    async fn submit_liveness(
        &self,
        req: Request<SubmitLivenessRequest>,
    ) -> Result<Response<ProtoAcceptedResponse>, Status> {
        let r = req.into_inner();
        let files: Vec<UploadedFile> = r
            .frames
            .into_iter()
            .map(|f| UploadedFile {
                buffer: f.data,
                filename: f.name,
                content_type: "image/jpeg".to_string(),
            })
            .collect();
        let result = self
            .service
            .submit_liveness(&r.token, files)
            .await
            .map_err(to_status)?;
        Ok(Response::new(ProtoAcceptedResponse {
            accepted: result.accepted,
        }))
    }

    async fn submit_claim_document(
        &self,
        req: Request<SubmitClaimDocumentRequest>,
    ) -> Result<Response<ProtoAcceptedResponse>, Status> {
        let r = req.into_inner();
        let file = file_from_proto(r.file_data, r.file_name, r.content_type);
        let result = self
            .service
            .submit_claim_document(&r.token, &r.method, file)
            .await
            .map_err(to_status)?;
        Ok(Response::new(ProtoAcceptedResponse {
            accepted: result.accepted,
        }))
    }

    async fn submit_self_report(
        &self,
        req: Request<SubmitSelfReportRequest>,
    ) -> Result<Response<ProtoAcceptedResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .submit_self_report(&r.token, &r.method, &r.reported_value)
            .await
            .map_err(to_status)?;
        Ok(Response::new(ProtoAcceptedResponse {
            accepted: result.accepted,
        }))
    }

    async fn submit_code(
        &self,
        req: Request<SubmitCodeRequest>,
    ) -> Result<Response<ProtoAcceptedResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .submit_code(&r.token, &r.method, &r.code)
            .await
            .map_err(to_status)?;
        Ok(Response::new(ProtoAcceptedResponse {
            accepted: result.accepted,
        }))
    }

    async fn submit_location(
        &self,
        req: Request<SubmitLocationRequest>,
    ) -> Result<Response<ProtoAcceptedResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .submit_location(&r.token, &r.method, r.latitude, r.longitude)
            .await
            .map_err(to_status)?;
        Ok(Response::new(ProtoAcceptedResponse {
            accepted: result.accepted,
        }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_new("info,svc_sessions=debug").unwrap(),
        )
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("SESSIONS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(50088);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let grpc = SessionsGrpc {
        service: SessionsService::new(pool),
    };

    info!(port, "svc-sessions starting (gRPC)");
    Server::builder()
        .add_service(SessionsApiServiceServer::new(grpc))
        .serve(addr)
        .await?;
    Ok(())
}
