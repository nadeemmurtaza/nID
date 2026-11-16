//! Account verification service -- gRPC client for `svc-account-verification`.
//!
//! Business logic moved to `crates/account_verification`, served by
//! `services/account_verification` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::account_verification::v1::{
    account_verification_service_client::AccountVerificationServiceClient, AccountIdRequest, CaseIdRequest,
    CreateCaseRequest as GrpcCreateCaseRequest,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::account_verification::dto::{
    BadgeEntry, CreateSelfVerificationCaseRequest, VerificationCaseResponse, VerificationStatusResponse,
};

pub struct AccountVerificationService {
    #[allow(dead_code)]
    db: DbPool,
    #[allow(dead_code)]
    env: AppEnv,
}

fn case_from_proto(c: newax_proto::account_verification::v1::VerificationCaseResponse) -> VerificationCaseResponse {
    VerificationCaseResponse {
        id: c.id,
        subject_id: c.subject_id,
        claim_type: c.claim_type,
        level: c.level,
        status: c.status,
        created_at: c.created_at,
        resolved_at: c.resolved_at,
    }
}

async fn client() -> Result<AccountVerificationServiceClient<nid_service_auth::AuthedChannel>> {
    let url = std::env::var("ACCOUNT_VERIFICATION_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:50075".to_string());
    nid_service_auth::connect(url)
        .await
        .map(AccountVerificationServiceClient::new)
        .map_err(|e| anyhow!("account-verification service unreachable: {e}"))
}

impl AccountVerificationService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn get_status(&self, account_id: &str) -> Result<VerificationStatusResponse> {
        let mut c = client().await?;
        let resp = c
            .get_status(AccountIdRequest { account_id: account_id.to_string() })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?
            .into_inner();
        Ok(VerificationStatusResponse {
            account_id: resp.account_id,
            badges: resp
                .badges
                .into_iter()
                .map(|b| BadgeEntry { claim_type: b.claim_type, level: b.level, verified_at: b.verified_at })
                .collect(),
        })
    }

    pub async fn create_case(
        &self,
        account_id: &str,
        req: &CreateSelfVerificationCaseRequest,
    ) -> Result<VerificationCaseResponse> {
        let mut c = client().await?;
        let resp = c
            .create_case(GrpcCreateCaseRequest {
                account_id: account_id.to_string(),
                claim_type: req.claim_type.clone(),
                level: req.level.clone(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(case_from_proto(resp.into_inner()))
    }

    pub async fn list_cases(&self, account_id: &str) -> Result<Vec<VerificationCaseResponse>> {
        let mut c = client().await?;
        let resp = c
            .list_cases(AccountIdRequest { account_id: account_id.to_string() })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().cases.into_iter().map(case_from_proto).collect())
    }

    pub async fn get_case(&self, account_id: &str, case_id: &str) -> Result<VerificationCaseResponse> {
        let mut c = client().await?;
        let resp = c
            .get_case(CaseIdRequest { account_id: account_id.to_string(), case_id: case_id.to_string() })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(case_from_proto(resp.into_inner()))
    }
}
