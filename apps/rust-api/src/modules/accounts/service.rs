//! Accounts service — business logic for account operations.
//!
//! Mirrors `apps/api/src/modules/accounts/accounts.service.ts`.

use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use deadpool_postgres::Object;
use nid_shared_types::{generate_session_token, sha256_hex};
use rand::Rng;
use sqlx::{FromRow, Row};
use tracing::info;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::accounts::dto::{AccountResponse, VerifyOtpResponse};

const OTP_CODE_LENGTH: usize = 6;
const OTP_TTL_MINUTES: i64 = 10;
const SESSION_TTL_DAYS: i64 = 30;
const MAX_OTP_ATTEMPTS: i32 = 5;
const OTP_RESEND_COOLDOWN_SECONDS: i64 = 30;

/// Account row from database
#[derive(Debug, Clone, FromRow)]
pub struct AccountRow {
    pub id: String,
    pub phone: String,
    pub email: Option<String>,
    pub phone_verified_at: Option<chrono::DateTime<chrono::Utc>>,
    pub email_verified_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl From<AccountRow> for AccountResponse {
    fn from(row: AccountRow) -> Self {
        Self {
            id: row.id,
            phone: row.phone,
            email: row.email,
            phone_verified_at: row.phone_verified_at.map(|dt| dt.to_rfc3339()),
            email_verified_at: row.email_verified_at.map(|dt| dt.to_rfc3339()),
        }
    }
}

/// Accounts service — handles OTP flow, session management, and email verification.
pub struct AccountsService {
    db: DbPool,
    env: AppEnv,
}

impl AccountsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    /// Start an OTP challenge for the given phone number.
    pub async fn start_otp(&self, phone: &str) -> Result<()> {
        let conn = self.db.get().await?;

        // Check cooldown — only while a code is still outstanding
        let outstanding: Option<(i64,)> = sqlx::query_as(
            r#"
            SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) as elapsed
            FROM account_otp_code
            WHERE phone = $1 AND consumed_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(phone)
        .fetch_optional(&mut *conn)
        .await?;

        if let Some((elapsed,)) = outstanding {
            if elapsed < OTP_RESEND_COOLDOWN_SECONDS as f64 {
                return Err(anyhow!("Please wait before requesting another code."));
            }
        }

        // Generate OTP code
        let mut rng = rand::thread_rng();
        let code = rng.gen_range(0..10u32).to_string()
            .pad_start(OTP_CODE_LENGTH, '0');
        let code_hash = sha256_hex(&code);
        let expires_at = Utc::now() + chrono::Duration::minutes(OTP_TTL_MINUTES);

        sqlx::query(
            r#"
            INSERT INTO account_otp_code (id, phone, code_hash, expires_at)
            VALUES (gen_random_uuid(), $1, $2, $3)
            "#,
        )
        .bind(phone)
        .bind(&code_hash)
        .bind(expires_at)
        .execute(&mut *conn)
        .await?;

        if !self.env.otp_sms_dev_mode {
            return Err(anyhow!(
                "Account OTP delivery has no production SMS vendor wired up yet"
            ));
        }

        info!("[accounts:dev] would send login code {} to {}", code, phone);
        Ok(())
    }

    /// Verify an OTP code, creating the account if needed and returning a session.
    pub async fn verify_otp(&self, phone: &str, code: &str) -> Result<VerifyOtpResponse> {
        let conn = self.db.get().await?;

        // Find the live challenge
        let challenge: Option<(String, String, i32)> = sqlx::query_as(
            r#"
            SELECT id, code_hash, attempts
            FROM account_otp_code
            WHERE phone = $1 AND consumed_at IS NULL AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(phone)
        .fetch_optional(&mut *conn)
        .await?;

        let challenge = challenge.ok_or_else(|| anyhow!("That code is incorrect or has expired."))?;
        let (challenge_id, code_hash, attempts) = challenge;

        if attempts >= MAX_OTP_ATTEMPTS {
            sqlx::query("UPDATE account_otp_code SET consumed_at = NOW() WHERE id = $1")
                .bind(&challenge_id)
                .execute(&mut *conn)
                .await?;
            return Err(anyhow!("Too many incorrect attempts. Request a new code."));
        }

        let submitted_hash = sha256_hex(code);
        if submitted_hash != code_hash {
            sqlx::query(
                "UPDATE account_otp_code SET attempts = attempts + 1 WHERE id = $1",
            )
            .bind(&challenge_id)
            .execute(&mut *conn)
            .await?;
            return Err(anyhow!("That code is incorrect or has expired."));
        }

        // Consume the code
        sqlx::query("UPDATE account_otp_code SET consumed_at = NOW() WHERE id = $1")
            .bind(&challenge_id)
            .execute(&mut *conn)
            .await?;

        // Upsert account
        let now = Utc::now();
        let account: AccountRow = sqlx::query_as(
            r#"
            INSERT INTO account (id, phone, phone_verified_at)
            VALUES (gen_random_uuid(), $1, $2)
            ON CONFLICT (phone)
            DO UPDATE SET phone_verified_at = $2
            RETURNING id, phone, email, phone_verified_at, email_verified_at
            "#,
        )
        .bind(phone)
        .bind(now)
        .fetch_one(&mut *conn)
        .await?;

        // Create session
        let session = generate_session_token();
        let expires_at = Utc::now() + chrono::Duration::days(SESSION_TTL_DAYS);

        sqlx::query(
            r#"
            INSERT INTO account_session (id, account_id, token_hash, expires_at)
            VALUES (gen_random_uuid(), $1, $2, $3)
            "#,
        )
        .bind(&account.id)
        .bind(&session.hash)
        .bind(expires_at)
        .execute(&mut *conn)
        .await?;

        Ok(VerifyOtpResponse {
            session_token: session.plaintext,
            account: account.into(),
        })
    }

    /// Resolve a session token to an account.
    pub async fn resolve_session(&self, token: &str) -> Result<AccountRow> {
        let conn = self.db.get().await?;
        let token_hash = sha256_hex(token);

        let account: AccountRow = sqlx::query_as(
            r#"
            SELECT a.id, a.phone, a.email, a.phone_verified_at, a.email_verified_at
            FROM account_session s
            JOIN account a ON s.account_id = a.id
            WHERE s.token_hash = $1 AND s.expires_at > NOW()
            "#,
        )
        .bind(&token_hash)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Invalid or expired session"))?;

        Ok(account)
    }

    /// Revoke a single session by token hash.
    pub async fn revoke_session(&self, token_hash: &str) -> Result<()> {
        let conn = self.db.get().await?;
        sqlx::query("DELETE FROM account_session WHERE token_hash = $1")
            .bind(token_hash)
            .execute(&mut *conn)
            .await?;
        Ok(())
    }

    /// Revoke all sessions for an account.
    pub async fn revoke_all_sessions(&self, account_id: &str) -> Result<()> {
        let conn = self.db.get().await?;
        sqlx::query("DELETE FROM account_session WHERE account_id = $1")
            .bind(account_id)
            .execute(&mut *conn)
            .await?;
        Ok(())
    }

    /// Get the current account by ID.
    pub async fn get_account(&self, account_id: &str) -> Result<AccountRow> {
        let conn = self.db.get().await?;
        let account: AccountRow = sqlx::query_as(
            "SELECT id, phone, email, phone_verified_at, email_verified_at FROM account WHERE id = $1",
        )
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Account not found"))?;
        Ok(account)
    }
}
