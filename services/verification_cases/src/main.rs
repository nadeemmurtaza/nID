use newax_verification_cases::{
    CreatedCaseResponse, MessageResponse, MethodAttemptResponse,
    SubjectSummary, VerificationCaseResponse, VerificationCaseWithAttempts,
    VerificationCaseWithSubject, VerificationCasesService,
};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.verification_cases.v1");
}

use proto::{
    verification_cases_api_service_server::{
        VerificationCasesApiService as VcRpc, VerificationCasesApiServiceServer,
    },
    CaseListResponse as ProtoCaseList,
    CreatedCaseResponse as ProtoCreatedCase,
    CreateCaseRequest as ProtoCreateReq,
    GetCaseRequest,
    ListCasesRequest,
    MessageResponse as ProtoMessage,
    MethodAttemptResponse as ProtoAttempt,
    ResolveCaseRequest as ProtoResolveReq,
    SubjectSummary as ProtoSubject,
    SubmitAgentAttestationRequest as ProtoAgentReq,
    SubmitCodeRequest as ProtoCodeReq,
    SubmitLocationRequest as ProtoLocationReq,
    SubmitOtpCodeRequest,
    SubmitSelfReportRequest as ProtoSelfReportReq,
    VerificationCaseResponse as ProtoCase,
    VerificationCaseWithAttempts as ProtoCaseWithAttempts,
    VerificationCaseWithSubject as ProtoCaseWithSubject,
};

struct VcGrpc {
    service: VerificationCasesService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") {
        Status::not_found(msg)
    } else if msg.contains("Invalid") || msg.contains("must be") {
        Status::invalid_argument(msg)
    } else {
        Status::internal(msg)
    }
}

fn case_to_proto(r: VerificationCaseResponse) -> ProtoCase {
    ProtoCase {
        id: r.id,
        tenant_id: r.tenant_id,
        subject_id: r.subject_id,
        policy_id: r.policy_id,
        status: r.status,
        temporal_workflow_id: r.temporal_workflow_id,
        decision: r.decision,
        reviewer_id: r.reviewer_id,
        claim_type: r.claim_type,
        level: r.level,
        created_at: r.created_at,
        updated_at: r.updated_at,
        resolved_at: r.resolved_at,
    }
}

fn subject_to_proto(s: SubjectSummary) -> ProtoSubject {
    ProtoSubject {
        id: s.id,
        given_name: s.given_name,
        family_name: s.family_name,
        email: s.email,
        phone: s.phone,
    }
}

fn attempt_to_proto(a: MethodAttemptResponse) -> ProtoAttempt {
    ProtoAttempt {
        id: a.id,
        tenant_id: a.tenant_id,
        case_id: a.case_id,
        method: a.method,
        status: a.status,
        provider_key: a.provider_key,
        result_meta: a
            .result_meta
            .and_then(|v| serde_json::to_string(&v).ok()),
        score: a.score,
        started_at: a.started_at,
        completed_at: a.completed_at,
    }
}

fn case_with_subject_to_proto(c: VerificationCaseWithSubject) -> ProtoCaseWithSubject {
    ProtoCaseWithSubject {
        id: c.id,
        tenant_id: c.tenant_id,
        subject_id: c.subject_id,
        policy_id: c.policy_id,
        status: c.status,
        temporal_workflow_id: c.temporal_workflow_id,
        decision: c.decision,
        reviewer_id: c.reviewer_id,
        claim_type: c.claim_type,
        level: c.level,
        created_at: c.created_at,
        updated_at: c.updated_at,
        resolved_at: c.resolved_at,
        subject: Some(subject_to_proto(c.subject)),
    }
}

fn case_with_attempts_to_proto(c: VerificationCaseWithAttempts) -> ProtoCaseWithAttempts {
    ProtoCaseWithAttempts {
        id: c.id,
        tenant_id: c.tenant_id,
        subject_id: c.subject_id,
        policy_id: c.policy_id,
        status: c.status,
        temporal_workflow_id: c.temporal_workflow_id,
        decision: c.decision,
        reviewer_id: c.reviewer_id,
        claim_type: c.claim_type,
        level: c.level,
        created_at: c.created_at,
        updated_at: c.updated_at,
        resolved_at: c.resolved_at,
        attempts: c.attempts.into_iter().map(attempt_to_proto).collect(),
        subject: Some(subject_to_proto(c.subject)),
    }
}

fn created_case_to_proto(c: CreatedCaseResponse) -> ProtoCreatedCase {
    ProtoCreatedCase {
        id: c.id,
        tenant_id: c.tenant_id,
        subject_id: c.subject_id,
        policy_id: c.policy_id,
        status: c.status,
        temporal_workflow_id: c.temporal_workflow_id,
        claim_type: c.claim_type,
        level: c.level,
        created_at: c.created_at,
        updated_at: c.updated_at,
        session_token: c.session_token,
        hosted_url: c.hosted_url,
    }
}

fn msg_to_proto(m: MessageResponse) -> ProtoMessage {
    ProtoMessage {
        message: m.message,
    }
}

#[tonic::async_trait]
impl VcRpc for VcGrpc {
    async fn create(
        &self,
        req: Request<ProtoCreateReq>,
    ) -> Result<Response<ProtoCreatedCase>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .create(&r.tenant_id, &r.api_key_id, &r.subject_id, &r.policy_name)
            .await
            .map_err(to_status)?;
        Ok(Response::new(created_case_to_proto(result)))
    }

    async fn list(
        &self,
        req: Request<ListCasesRequest>,
    ) -> Result<Response<ProtoCaseList>, Status> {
        let r = req.into_inner();
        let cases = self
            .service
            .list(&r.tenant_id, &r.actor_type, &r.actor_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(ProtoCaseList {
            cases: cases.into_iter().map(case_with_subject_to_proto).collect(),
        }))
    }

    async fn get_by_id(
        &self,
        req: Request<GetCaseRequest>,
    ) -> Result<Response<ProtoCaseWithAttempts>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .get_by_id(&r.tenant_id, &r.actor_type, &r.actor_id, &r.case_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(case_with_attempts_to_proto(result)))
    }

    async fn resolve_case(
        &self,
        req: Request<ProtoResolveReq>,
    ) -> Result<Response<ProtoCase>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .resolve_case(
                &r.tenant_id,
                &r.actor_type,
                &r.actor_id,
                &r.case_id,
                &r.decision,
                r.reason.as_deref(),
            )
            .await
            .map_err(to_status)?;
        Ok(Response::new(case_to_proto(result)))
    }

    async fn submit_otp_code(
        &self,
        req: Request<SubmitOtpCodeRequest>,
    ) -> Result<Response<ProtoMessage>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .submit_otp_code(&r.tenant_id, &r.api_key_id, &r.case_id, &r.code)
            .await
            .map_err(to_status)?;
        Ok(Response::new(msg_to_proto(result)))
    }

    async fn submit_self_report(
        &self,
        req: Request<ProtoSelfReportReq>,
    ) -> Result<Response<ProtoMessage>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .submit_self_report(
                &r.tenant_id,
                &r.api_key_id,
                &r.case_id,
                &r.method,
                &r.reported_value,
            )
            .await
            .map_err(to_status)?;
        Ok(Response::new(msg_to_proto(result)))
    }

    async fn submit_agent_attestation(
        &self,
        req: Request<ProtoAgentReq>,
    ) -> Result<Response<ProtoMessage>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .submit_agent_attestation(
                &r.tenant_id,
                &r.api_key_id,
                &r.case_id,
                &r.method,
                &r.decision,
                r.notes.as_deref(),
            )
            .await
            .map_err(to_status)?;
        Ok(Response::new(msg_to_proto(result)))
    }

    async fn submit_code(
        &self,
        req: Request<ProtoCodeReq>,
    ) -> Result<Response<ProtoMessage>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .submit_code(&r.tenant_id, &r.api_key_id, &r.case_id, &r.method, &r.code)
            .await
            .map_err(to_status)?;
        Ok(Response::new(msg_to_proto(result)))
    }

    async fn submit_location(
        &self,
        req: Request<ProtoLocationReq>,
    ) -> Result<Response<ProtoMessage>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .submit_location(
                &r.tenant_id,
                &r.api_key_id,
                &r.case_id,
                &r.method,
                r.latitude,
                r.longitude,
            )
            .await
            .map_err(to_status)?;
        Ok(Response::new(msg_to_proto(result)))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_new("info,svc_verification_cases=debug").unwrap(),
        )
        .init();

    let database_url = std::env::var("APP_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .map_err(|_| "APP_DATABASE_URL (or DATABASE_URL) must be set")?;
    let pool = PgPoolOptions::new().max_connections(5).connect(&database_url).await?;

    let port: u16 = std::env::var("VERIFICATION_CASES_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(50085);
    let addr = format!("0.0.0.0:{port}").parse()?;

    let session_ttl: i64 = std::env::var("SESSION_TTL_MINUTES")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(60);
    let verify_ui_url =
        std::env::var("VERIFY_UI_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());

    let grpc = VcGrpc {
        service: VerificationCasesService::new(pool, session_ttl, &verify_ui_url),
    };

    info!(port, "svc-verification-cases starting (gRPC)");
    Server::builder()
        .add_service(VerificationCasesApiServiceServer::new(grpc))
        .serve(addr)
        .await?;
    Ok(())
}
