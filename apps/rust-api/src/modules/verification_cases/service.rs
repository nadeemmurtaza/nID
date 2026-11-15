//! Verification Cases service -- gRPC client for `svc-verification-cases`.
//!
//! Business logic moved to `crates/verification_cases`, served by
//! `services/verification_cases` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::verification_cases::v1::{
    verification_cases_api_service_client::VerificationCasesApiServiceClient,
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

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::verification_cases::dto::{
    CreateVerificationCaseRequest, CreatedCaseResponse, MessageResponse, MethodAttemptResponse,
    SubjectSummary, VerificationCaseResponse, VerificationCaseWithAttempts,
    VerificationCaseWithSubject,
};

pub struct VerificationCasesService {
    #[allow(dead_code)]
    db: DbPool,
    #[allow(dead_code)]
    env: AppEnv,
}

impl VerificationCasesService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    fn case_from_proto(p: ProtoCase) -> VerificationCaseResponse {
        VerificationCaseResponse {
            id: p.id,
            tenant_id: p.tenant_id,
            subject_id: p.subject_id,
            policy_id: p.policy_id,
            status: p.status,
            temporal_workflow_id: p.temporal_workflow_id,
            decision: p.decision,
            reviewer_id: p.reviewer_id,
            claim_type: p.claim_type,
            level: p.level,
            created_at: p.created_at,
            updated_at: p.updated_at,
            resolved_at: p.resolved_at,
        }
    }

    fn subject_from_proto(p: ProtoSubject) -> SubjectSummary {
        SubjectSummary {
            id: p.id,
            given_name: p.given_name,
            family_name: p.family_name,
            email: p.email,
            phone: p.phone,
        }
    }

    fn attempt_from_proto(p: ProtoAttempt) -> MethodAttemptResponse {
        MethodAttemptResponse {
            id: p.id,
            tenant_id: p.tenant_id,
            case_id: p.case_id,
            method: p.method,
            status: p.status,
            provider_key: p.provider_key,
            result_meta: p.result_meta.and_then(|s| serde_json::from_str(&s).ok()),
            score: p.score,
            started_at: p.started_at,
            completed_at: p.completed_at,
        }
    }

    fn case_with_subject_from_proto(p: ProtoCaseWithSubject) -> VerificationCaseWithSubject {
        VerificationCaseWithSubject {
            id: p.id,
            tenant_id: p.tenant_id,
            subject_id: p.subject_id,
            policy_id: p.policy_id,
            status: p.status,
            temporal_workflow_id: p.temporal_workflow_id,
            decision: p.decision,
            reviewer_id: p.reviewer_id,
            claim_type: p.claim_type,
            level: p.level,
            created_at: p.created_at,
            updated_at: p.updated_at,
            resolved_at: p.resolved_at,
            subject: p.subject
                .map(Self::subject_from_proto)
                .unwrap_or_else(|| SubjectSummary {
                    id: String::new(),
                    given_name: None,
                    family_name: None,
                    email: None,
                    phone: None,
                }),
        }
    }

    fn case_with_attempts_from_proto(
        p: ProtoCaseWithAttempts,
    ) -> VerificationCaseWithAttempts {
        VerificationCaseWithAttempts {
            id: p.id,
            tenant_id: p.tenant_id,
            subject_id: p.subject_id,
            policy_id: p.policy_id,
            status: p.status,
            temporal_workflow_id: p.temporal_workflow_id,
            decision: p.decision,
            reviewer_id: p.reviewer_id,
            claim_type: p.claim_type,
            level: p.level,
            created_at: p.created_at,
            updated_at: p.updated_at,
            resolved_at: p.resolved_at,
            attempts: p.attempts.into_iter().map(Self::attempt_from_proto).collect(),
            subject: p.subject
                .map(Self::subject_from_proto)
                .unwrap_or_else(|| SubjectSummary {
                    id: String::new(),
                    given_name: None,
                    family_name: None,
                    email: None,
                    phone: None,
                }),
        }
    }

    fn created_case_from_proto(p: ProtoCreatedCase) -> CreatedCaseResponse {
        CreatedCaseResponse {
            id: p.id,
            tenant_id: p.tenant_id,
            subject_id: p.subject_id,
            policy_id: p.policy_id,
            status: p.status,
            temporal_workflow_id: p.temporal_workflow_id,
            claim_type: p.claim_type,
            level: p.level,
            created_at: p.created_at,
            updated_at: p.updated_at,
            session_token: p.session_token,
            hosted_url: p.hosted_url,
        }
    }

    fn msg_from_proto(p: ProtoMessage) -> MessageResponse {
        MessageResponse {
            message: p.message,
        }
    }

    async fn client() -> Result<VerificationCasesApiServiceClient<tonic::transport::Channel>> {
        let url = std::env::var("VERIFICATION_CASES_SERVICE_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:50085".to_string());
        VerificationCasesApiServiceClient::connect(url)
            .await
            .map_err(|e| anyhow!("verification_cases service unreachable: {e}"))
    }

    /// Create a new verification case
    pub async fn create(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        req: &crate::modules::verification_cases::dto::CreateVerificationCaseRequest,
    ) -> Result<CreatedCaseResponse> {
        let mut client = Self::client().await?;
        let r = client
            .create(ProtoCreateReq {
                tenant_id: tenant_id.to_string(),
                api_key_id: api_key_id.to_string(),
                subject_id: req.subject_id.clone(),
                policy_name: req.policy_name.clone(),
                phone: req.phone.clone(),
                reference_id: req.reference_id.clone(),
                account_title: req.account_title.clone(),
                organization_id: req.organization_id.clone(),
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::created_case_from_proto(r.into_inner()))
    }

    /// List verification cases (most recent first)
    pub async fn list(
        &self,
        tenant_id: &str,
        actor_type: &str,
        actor_id: &str,
    ) -> Result<Vec<VerificationCaseWithSubject>> {
        let mut client = Self::client().await?;
        let r = client
            .list(ListCasesRequest {
                tenant_id: tenant_id.to_string(),
                actor_type: actor_type.to_string(),
                actor_id: actor_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(r.into_inner()
            .cases
            .into_iter()
            .map(Self::case_with_subject_from_proto)
            .collect())
    }

    /// Get verification case by ID with attempts
    pub async fn get_by_id(
        &self,
        tenant_id: &str,
        actor_type: &str,
        actor_id: &str,
        case_id: &str,
    ) -> Result<VerificationCaseWithAttempts> {
        let mut client = Self::client().await?;
        let r = client
            .get_by_id(GetCaseRequest {
                tenant_id: tenant_id.to_string(),
                actor_type: actor_type.to_string(),
                actor_id: actor_id.to_string(),
                case_id: case_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::case_with_attempts_from_proto(r.into_inner()))
    }

    /// Resolve a case (manual review decision)
    pub async fn resolve_case(
        &self,
        tenant_id: &str,
        actor_type: &str,
        actor_id: &str,
        case_id: &str,
        decision: &str,
        reason: Option<&str>,
    ) -> Result<VerificationCaseResponse> {
        let mut client = Self::client().await?;
        let r = client
            .resolve_case(ProtoResolveReq {
                tenant_id: tenant_id.to_string(),
                actor_type: actor_type.to_string(),
                actor_id: actor_id.to_string(),
                case_id: case_id.to_string(),
                decision: decision.to_string(),
                reason: reason.map(|s| s.to_string()),
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::case_from_proto(r.into_inner()))
    }

    /// Submit OTP code
    pub async fn submit_otp_code(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        case_id: &str,
        code: &str,
    ) -> Result<MessageResponse> {
        let mut client = Self::client().await?;
        let r = client
            .submit_otp_code(SubmitOtpCodeRequest {
                tenant_id: tenant_id.to_string(),
                api_key_id: api_key_id.to_string(),
                case_id: case_id.to_string(),
                code: code.to_string(),
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::msg_from_proto(r.into_inner()))
    }

    /// Submit a self-reported value for a claim method
    pub async fn submit_self_report(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        case_id: &str,
        method: &str,
        reported_value: &str,
    ) -> Result<MessageResponse> {
        let mut client = Self::client().await?;
        let r = client
            .submit_self_report(ProtoSelfReportReq {
                tenant_id: tenant_id.to_string(),
                api_key_id: api_key_id.to_string(),
                case_id: case_id.to_string(),
                method: method.to_string(),
                reported_value: reported_value.to_string(),
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::msg_from_proto(r.into_inner()))
    }

    /// Submit agent attestation for a claim method
    pub async fn submit_agent_attestation(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        case_id: &str,
        method: &str,
        decision: &str,
        notes: Option<&str>,
    ) -> Result<MessageResponse> {
        let mut client = Self::client().await?;
        let r = client
            .submit_agent_attestation(ProtoAgentReq {
                tenant_id: tenant_id.to_string(),
                api_key_id: api_key_id.to_string(),
                case_id: case_id.to_string(),
                method: method.to_string(),
                decision: decision.to_string(),
                notes: notes.map(|s| s.to_string()),
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::msg_from_proto(r.into_inner()))
    }

    /// Submit a code (e.g. postal OTP) for a claim method
    pub async fn submit_code(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        case_id: &str,
        method: &str,
        code: &str,
    ) -> Result<MessageResponse> {
        let mut client = Self::client().await?;
        let r = client
            .submit_code(ProtoCodeReq {
                tenant_id: tenant_id.to_string(),
                api_key_id: api_key_id.to_string(),
                case_id: case_id.to_string(),
                method: method.to_string(),
                code: code.to_string(),
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::msg_from_proto(r.into_inner()))
    }

    /// Submit location coordinates for a claim method
    pub async fn submit_location(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        case_id: &str,
        method: &str,
        latitude: f64,
        longitude: f64,
    ) -> Result<MessageResponse> {
        let mut client = Self::client().await?;
        let r = client
            .submit_location(ProtoLocationReq {
                tenant_id: tenant_id.to_string(),
                api_key_id: api_key_id.to_string(),
                case_id: case_id.to_string(),
                method: method.to_string(),
                latitude,
                longitude,
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::msg_from_proto(r.into_inner()))
    }
}
