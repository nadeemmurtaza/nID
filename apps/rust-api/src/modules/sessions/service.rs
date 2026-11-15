//! Sessions service — gRPC client for `svc-sessions`.
//!
//! Business logic moved to `crates/sessions`, served by
//! `services/sessions` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::sessions::v1::{
    sessions_api_service_client::SessionsApiServiceClient,
    AcceptedResponse as ProtoAcceptedResponse,
    AttemptEntry as ProtoAttemptEntry, SessionStatusResponse as ProtoSessionStatusResponse,
    SubmitClaimDocumentRequest, SubmitCodeRequest, SubmitDocumentRequest, SubmitLocationRequest,
    SubmitLivenessRequest, SubmitOtpRequest, SubmitSelfReportRequest, TokenRequest,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::core::upload::UploadedFile;
use crate::modules::sessions::dto::{
    AcceptedResponse, AttemptEntry, SessionStatusResponse,
};

pub struct SessionsService {
    #[allow(dead_code)]
    db: DbPool,
    env: AppEnv,
}

fn status_from_proto(p: ProtoSessionStatusResponse) -> SessionStatusResponse {
    SessionStatusResponse {
        case_id: p.case_id,
        status: p.status,
        claim_type: p.claim_type,
        level: p.level,
        resolved_at: p.resolved_at,
        attempts: p
            .attempts
            .into_iter()
            .map(|a| AttemptEntry {
                method: a.method,
                status: a.status,
            })
            .collect(),
        phone: p.phone,
    }
}

fn file_to_proto(f: UploadedFile) -> (Vec<u8>, String, String) {
    (f.buffer, f.filename, f.content_type)
}

async fn client() -> Result<SessionsApiServiceClient<tonic::transport::Channel>> {
    let url = std::env::var("SESSIONS_SERVICE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:50088".to_string());
    SessionsApiServiceClient::connect(url)
        .await
        .map_err(|e| anyhow!("sessions service unreachable: {e}"))
}

impl SessionsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn get_status(&self, token: &str) -> Result<SessionStatusResponse> {
        let mut c = client().await?;
        let resp = c
            .get_status(TokenRequest {
                token: token.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(status_from_proto(resp.into_inner()))
    }

    pub async fn submit_otp(&self, token: &str, code: &str) -> Result<AcceptedResponse> {
        let mut c = client().await?;
        let resp = c
            .submit_otp(SubmitOtpRequest {
                token: token.to_string(),
                code: code.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(AcceptedResponse {
            accepted: resp.into_inner().accepted,
        })
    }

    pub async fn submit_document(&self, token: &str, file: UploadedFile) -> Result<AcceptedResponse> {
        let (data, name, ctype) = file_to_proto(file);
        let mut c = client().await?;
        let resp = c
            .submit_document(SubmitDocumentRequest {
                token: token.to_string(),
                file_data: data,
                file_name: name,
                content_type: ctype,
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(AcceptedResponse {
            accepted: resp.into_inner().accepted,
        })
    }

    pub async fn submit_liveness(
        &self,
        token: &str,
        files: Vec<UploadedFile>,
    ) -> Result<AcceptedResponse> {
        let frames = files
            .into_iter()
            .map(|f| newax_proto::sessions::v1::LivenessFrame {
                data: f.buffer,
                name: f.filename,
            })
            .collect();
        let mut c = client().await?;
        let resp = c
            .submit_liveness(SubmitLivenessRequest {
                token: token.to_string(),
                frames,
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(AcceptedResponse {
            accepted: resp.into_inner().accepted,
        })
    }

    pub async fn submit_claim_document(
        &self,
        token: &str,
        method: &str,
        file: UploadedFile,
    ) -> Result<AcceptedResponse> {
        let (data, name, ctype) = file_to_proto(file);
        let mut c = client().await?;
        let resp = c
            .submit_claim_document(SubmitClaimDocumentRequest {
                token: token.to_string(),
                method: method.to_string(),
                file_data: data,
                file_name: name,
                content_type: ctype,
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(AcceptedResponse {
            accepted: resp.into_inner().accepted,
        })
    }

    pub async fn submit_self_report(
        &self,
        token: &str,
        method: &str,
        reported_value: &str,
    ) -> Result<AcceptedResponse> {
        let mut c = client().await?;
        let resp = c
            .submit_self_report(SubmitSelfReportRequest {
                token: token.to_string(),
                method: method.to_string(),
                reported_value: reported_value.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(AcceptedResponse {
            accepted: resp.into_inner().accepted,
        })
    }

    pub async fn submit_code(
        &self,
        token: &str,
        method: &str,
        code: &str,
    ) -> Result<AcceptedResponse> {
        let mut c = client().await?;
        let resp = c
            .submit_code(SubmitCodeRequest {
                token: token.to_string(),
                method: method.to_string(),
                code: code.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(AcceptedResponse {
            accepted: resp.into_inner().accepted,
        })
    }

    pub async fn submit_location(
        &self,
        token: &str,
        method: &str,
        latitude: f64,
        longitude: f64,
    ) -> Result<AcceptedResponse> {
        let mut c = client().await?;
        let resp = c
            .submit_location(SubmitLocationRequest {
                token: token.to_string(),
                method: method.to_string(),
                latitude,
                longitude,
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(AcceptedResponse {
            accepted: resp.into_inner().accepted,
        })
    }
}
