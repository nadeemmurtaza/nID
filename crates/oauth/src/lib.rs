//! OAuth service — business logic for OAuth operations.
//!
//! Extracted from `apps/rust-api/src/modules/oauth/service.rs` as part of
//! CONVENTIONS.md's crates/services split. Takes a plain `sqlx::PgPool`
//! rather than nID's `core::db::DbPool` wrapper.

use anyhow::{anyhow, Result};
use chrono::{Duration, Utc};
use nid_shared_types::{generate_session_token, sha256_hex};
use sqlx::{PgPool, Postgres, Row, Transaction};

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

    /// Open a transaction with the RLS tenant context set. The setting is
    /// transaction-local, so it must be made on the transaction itself.
    async fn tenant_tx(&self, tenant_id: &str) -> Result<Transaction<'_, Postgres>> {
        let mut tx = self.db.begin().await?;
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;
        Ok(tx)
    }

    pub async fn create_login_request(
        &self,
        client_id: &str,
        redirect_uri: &str,
        state: Option<&str>,
    ) -> Result<LoginRequestStatusResponse> {
        let client = sqlx::query(
            "SELECT id, tenant_id, redirect_uris FROM oauth_client WHERE client_id = $1",
        )
        .bind(client_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow!("Client not found"))?;
        let client_row_id: String = client.get("id");
        let tenant_id: String = client.get("tenant_id");
        let allowed: Vec<String> = client.get("redirect_uris");

        // Exact match against the client's registered URIs: an open redirect
        // here would hand the authorization result to an attacker.
        if !allowed.iter().any(|u| u == redirect_uri) {
            return Err(anyhow!("redirect_uri is not registered for this client"));
        }

        let poll = generate_session_token();
        let expires_at = Utc::now() + Duration::minutes(10);

        let mut tx = self.tenant_tx(&tenant_id).await?;
        sqlx::query(
            r#"
            INSERT INTO oauth_login_request (id, tenant_id, client_id, redirect_uri, state, poll_token_hash, expires_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(&tenant_id)
        .bind(&client_row_id)
        .bind(redirect_uri)
        .bind(state)
        .bind(&poll.hash)
        .bind(expires_at)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(LoginRequestStatusResponse {
            status: "PENDING".to_string(),
            approval_url: Some(format!("/authorize/{}", poll.plaintext)),
        })
    }

    pub async fn get_status(&self, poll_token: &str) -> Result<LoginRequestStatusResponse> {
        let row = sqlx::query(
            "SELECT status, expires_at FROM oauth_login_request WHERE poll_token_hash = $1",
        )
        .bind(sha256_hex(poll_token))
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow!("Login request not found"))?;

        let expires_at: chrono::DateTime<Utc> = row.get("expires_at");
        let status: String = row.get("status");
        let status = if status == "PENDING" && expires_at < Utc::now() { "EXPIRED".to_string() } else { status };
        Ok(LoginRequestStatusResponse { status, approval_url: None })
    }

    pub async fn approve(&self, poll_token: &str, account_id: &str) -> Result<()> {
        let hash = sha256_hex(poll_token);
        let tenant_id: String = sqlx::query_scalar(
            "SELECT tenant_id FROM oauth_login_request WHERE poll_token_hash = $1",
        )
        .bind(&hash)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow!("Login request not found or already approved"))?;

        let mut tx = self.tenant_tx(&tenant_id).await?;
        let result = sqlx::query(
            r#"
            UPDATE oauth_login_request
            SET status = 'APPROVED', account_id = $1
            WHERE poll_token_hash = $2 AND status = 'PENDING' AND expires_at > NOW()
            "#,
        )
        .bind(account_id)
        .bind(&hash)
        .execute(&mut *tx)
        .await?;
        if result.rows_affected() == 0 {
            return Err(anyhow!("Login request not found, expired or already approved"));
        }
        tx.commit().await?;
        Ok(())
    }

    /// The device holding the poll token collects a one-time authorization
    /// code after approval. Only its hash is stored, and it is issued at most
    /// once.
    pub async fn claim(&self, poll_token: &str) -> Result<TokenResponse> {
        let hash = sha256_hex(poll_token);
        let tenant_id: String = sqlx::query_scalar(
            "SELECT tenant_id FROM oauth_login_request WHERE poll_token_hash = $1",
        )
        .bind(&hash)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow!("Login request not approved"))?;

        let code = generate_session_token();
        let mut tx = self.tenant_tx(&tenant_id).await?;
        let result = sqlx::query(
            r#"
            UPDATE oauth_login_request SET code_hash = $1
            WHERE poll_token_hash = $2 AND status = 'APPROVED'
              AND code_hash IS NULL AND expires_at > NOW()
            "#,
        )
        .bind(&code.hash)
        .bind(&hash)
        .execute(&mut *tx)
        .await?;
        if result.rows_affected() == 0 {
            return Err(anyhow!("Login request not approved"));
        }
        tx.commit().await?;

        Ok(TokenResponse {
            access_token: code.plaintext,
            token_type: "Bearer".to_string(),
            expires_in: Some(300),
        })
    }

    pub async fn exchange_token(
        &self,
        code: &str,
        client_id: &str,
        client_secret: &str,
        redirect_uri: &str,
    ) -> Result<TokenResponse> {
        let client = sqlx::query(
            "SELECT id, tenant_id FROM oauth_client WHERE client_id = $1 AND client_secret_hash = $2",
        )
        .bind(client_id)
        .bind(sha256_hex(client_secret))
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow!("Invalid client credentials"))?;
        let client_row_id: String = client.get("id");
        let tenant_id: String = client.get("tenant_id");

        let mut tx = self.tenant_tx(&tenant_id).await?;
        // Consume atomically; the code must belong to this client and the
        // redirect_uri used when the request was opened.
        let row = sqlx::query(
            r#"
            UPDATE oauth_login_request SET code_consumed_at = NOW()
            WHERE code_hash = $1 AND client_id = $2 AND redirect_uri = $3
              AND code_consumed_at IS NULL AND status = 'APPROVED'
              AND expires_at > NOW() - INTERVAL '5 minutes'
            RETURNING account_id
            "#,
        )
        .bind(sha256_hex(code))
        .bind(&client_row_id)
        .bind(redirect_uri)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| anyhow!("Invalid or expired code"))?;
        let account_id: String = row.get("account_id");

        // A real, revocable account session: the same credential the
        // account's own login produces, so every route that accepts a
        // session token accepts this one.
        let session = generate_session_token();
        sqlx::query(
            "INSERT INTO account_session (id, account_id, token_hash, expires_at) VALUES (gen_random_uuid(), $1, $2, $3)",
        )
        .bind(&account_id)
        .bind(&session.hash)
        .bind(Utc::now() + Duration::hours(1))
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(TokenResponse {
            access_token: session.plaintext,
            token_type: "Bearer".to_string(),
            expires_in: Some(3600),
        })
    }
}
