//! Accounts service -- gRPC client for `svc-accounts`.
//!
//! Business logic moved to `crates/accounts`, served by
//! `services/accounts` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::accounts::v1::{
    accounts_api_service_client::AccountsApiServiceClient,
    AccountIdRequest, AccountResponse as ProtoAccountResponse,
    Empty, LoginRequest as ProtoLoginRequest, RegisterRequest as ProtoRegisterRequest,
    SessionTokenRequest, StartEmailVerificationRequest,
    StartOtpRequest, VerifyEmailRequest, VerifyOtpRequest,
    VerifyOtpResponse as ProtoVerifyOtpResponse,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::accounts::dto::{AccountResponse, VerifyOtpResponse};

pub struct AccountsService {
    #[allow(dead_code)]
    db: DbPool,
    env: AppEnv,
}

fn account_from_proto(p: ProtoAccountResponse) -> AccountResponse {
    AccountResponse {
        id: p.id,
        phone: p.phone,
        email: p.email,
        name: p.name,
        phone_verified_at: p.phone_verified_at,
        email_verified_at: p.email_verified_at,
    }
}

async fn client() -> Result<AccountsApiServiceClient<nid_service_auth::AuthedChannel>> {
    let url = std::env::var("ACCOUNTS_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:50081".to_string());
    nid_service_auth::connect(url)
        .await
        .map(AccountsApiServiceClient::new)
        .map_err(|e| anyhow!("accounts service unreachable: {e}"))
}

impl AccountsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn start_otp(&self, phone: &str) -> Result<()> {
        let mut c = client().await?;
        c.start_otp(StartOtpRequest { phone: phone.to_string() })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn verify_otp(&self, phone: &str, code: &str) -> Result<VerifyOtpResponse> {
        let mut c = client().await?;
        let resp = c.verify_otp(VerifyOtpRequest {
            phone: phone.to_string(),
            code: code.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        let p = resp.into_inner();
        let account = p.account.map(account_from_proto).unwrap_or_else(|| AccountResponse {
            id: String::new(),
            phone: String::new(),
            email: None,
            name: None,
            phone_verified_at: None,
            email_verified_at: None,
        });
        Ok(VerifyOtpResponse {
            session_token: p.session_token,
            account,
        })
    }

    pub async fn get_account(&self, account_id: &str) -> Result<AccountResponse> {
        let mut c = client().await?;
        let resp = c.get_account(AccountIdRequest {
            account_id: account_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(account_from_proto(resp.into_inner()))
    }

    pub async fn revoke_session(&self, token_hash: &str) -> Result<()> {
        let mut c = client().await?;
        c.revoke_session(SessionTokenRequest {
            session_token_hash: token_hash.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn revoke_all_sessions(&self, account_id: &str) -> Result<()> {
        let mut c = client().await?;
        c.revoke_all_sessions(AccountIdRequest {
            account_id: account_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn start_email_verification(&self, account_id: &str, email: &str) -> Result<()> {
        let mut c = client().await?;
        c.start_email_verification(StartEmailVerificationRequest {
            account_id: account_id.to_string(),
            email: email.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn verify_email(&self, account_id: &str, code: &str) -> Result<AccountResponse> {
        let mut c = client().await?;
        let resp = c.verify_email(VerifyEmailRequest {
            account_id: account_id.to_string(),
            code: code.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(account_from_proto(resp.into_inner()))
    }

    pub async fn register(&self, name: &str, email: &str, phone: &str, password: &str) -> Result<AccountResponse> {
        let mut c = client().await?;
        let resp = c.register(ProtoRegisterRequest {
            name: name.to_string(),
            email: email.to_string(),
            phone: phone.to_string(),
            password: password.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(account_from_proto(resp.into_inner()))
    }

    pub async fn login(&self, email: &str, password: &str) -> Result<VerifyOtpResponse> {
        let mut c = client().await?;
        let resp = c.login(ProtoLoginRequest {
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        let p = resp.into_inner();
        let account = p.account.map(account_from_proto).unwrap_or_else(|| AccountResponse {
            id: String::new(),
            phone: String::new(),
            email: None,
            name: None,
            phone_verified_at: None,
            email_verified_at: None,
        });
        Ok(VerifyOtpResponse {
            session_token: p.session_token,
            account,
        })
    }

    /// COMPLIANCE_AND_ACCESSIBILITY_RULES.md §8: data deletion request.
    /// Erases the account and its own data; see `newax_accounts::AccountsService::delete_account`.
    pub async fn delete_account(&self, account_id: &str) -> Result<()> {
        let mut c = client().await?;
        c.delete_account(AccountIdRequest {
            account_id: account_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        tracing::info!(account_id = %account_id, "Account deleted on request");
        Ok(())
    }
}
