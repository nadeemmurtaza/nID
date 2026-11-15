//! OAuth service — business logic for OAuth operations.
//!
//! Extracted from `apps/rust-api/src/modules/oauth/service.rs` as part of
//! CONVENTIONS.md's crates/services split. Takes a plain `sqlx::PgPool`
//! rather than nID's `core::db::DbPool` wrapper.

use anyhow::{anyhow, Result};
use chrono::{Duration, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct LoginRequestStatusResponse {
    pub status: String,
    pub approval_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<i64>,
}

pub struct OAuthService {
    db: PgPool,
}

impl OAuthService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn create_login_request(
        &self,
        client_id: &str,
        redirect_uri: &str,
        state: Option<&str>,
    ) -> Result<LoginRequestStatusResponse> {
        // Verify client exists
        let client = sqlx::query(
            "SELECT id, tenant_id FROM oauth_client WHERE client_id = $1",
        )
        .bind(client_id)
        .fetch_optional(&self.db)
        .await?;

        if client.is_none() {
            return Err(anyhow!("Client not found"));
        }
        let client = client.unwrap();
        let tenant_id: String = client.get("tenant_id");

        let poll_token = Uuid::new_v4().to_string();
        let expires_at = Utc::now() + Duration::minutes(10);

        sqlx::query(
            r#"
            INSERT INTO oauth_login_request (id, tenant_id, client_id, redirect_uri, state, poll_token_hash, expires_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(&tenant_id)
        .bind(client_id)
        .bind(redirect_uri)
        .bind(state)
        .bind(&poll_token)
        .bind(expires_at)
        .execute(&self.db)
        .await?;

        Ok(LoginRequestStatusResponse {
            status: "PENDING".to_string(),
            approval_url: Some(format!("/authorize/{}", poll_token)),
        })
    }

    pub async fn get_status(&self, poll_token: &str) -> Result<LoginRequestStatusResponse> {
        let row = sqlx::query(
            "SELECT status, id FROM oauth_login_request WHERE poll_token_hash = $1",
        )
        .bind(poll_token)
        .fetch_optional(&self.db)
        .await?;

        match row {
            Some(r) => {
                let status: String = r.get("status");
                Ok(LoginRequestStatusResponse {
                    status,
                    approval_url: None,
                })
            }
            None => Err(anyhow!("Login request not found")),
        }
    }

    pub async fn approve(&self, poll_token: &str, account_id: &str) -> Result<()> {
        let code = Uuid::new_v4().to_string();
        let result = sqlx::query(
            r#"
            UPDATE oauth_login_request
            SET status = 'APPROVED', account_id = $1, code_hash = $2
            WHERE poll_token_hash = $3 AND status = 'PENDING'
            "#,
        )
        .bind(account_id)
        .bind(&code)
        .bind(poll_token)
        .execute(&self.db)
        .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Login request not found or already approved"));
        }

        Ok(())
    }

    pub async fn claim(&self, poll_token: &str) -> Result<TokenResponse> {
        let row = sqlx::query(
            "SELECT code_hash, client_id, redirect_uri FROM oauth_login_request WHERE poll_token_hash = $1 AND status = 'APPROVED'",
        )
        .bind(poll_token)
        .fetch_optional(&self.db)
        .await?;

        match row {
            Some(r) => {
                let code: String = r.get("code_hash");
                Ok(TokenResponse {
                    access_token: code,
                    token_type: "Bearer".to_string(),
                    expires_in: Some(3600),
                })
            }
            None => Err(anyhow!("Login request not approved")),
        }
    }

    pub async fn exchange_token(
        &self,
        code: &str,
        client_id: &str,
        client_secret: &str,
        _redirect_uri: &str,
    ) -> Result<TokenResponse> {
        // Verify client secret
        let client = sqlx::query(
            "SELECT id FROM oauth_client WHERE client_id = $1 AND client_secret_hash = $2",
        )
        .bind(client_id)
        .bind(client_secret)
        .fetch_optional(&self.db)
        .await?;

        if client.is_none() {
            return Err(anyhow!("Invalid client credentials"));
        }

        // Find and consume the code
        let row = sqlx::query(
            "SELECT id, account_id FROM oauth_login_request WHERE code_hash = $1 AND code_consumed_at IS NULL",
        )
        .bind(code)
        .fetch_optional(&self.db)
        .await?;

        if row.is_none() {
            return Err(anyhow!("Invalid or expired code"));
        }
        let row = row.unwrap();
        let request_id: String = row.get("id");

        // Consume the code
        sqlx::query(
            "UPDATE oauth_login_request SET code_consumed_at = NOW() WHERE id = $1",
        )
        .bind(&request_id)
        .execute(&self.db)
        .await?;

        let account_id: String = row.get("account_id");
        let access_token = format!("{}_{}", account_id, Uuid::new_v4());

        Ok(TokenResponse {
            access_token,
            token_type: "Bearer".to_string(),
            expires_in: Some(3600),
        })
    }
}
