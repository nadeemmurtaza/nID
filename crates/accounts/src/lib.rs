//! Accounts service — business logic for account operations.
//!
//! Extracted from `apps/rust-api/src/modules/accounts/service.rs` as part of
//! CONVENTIONS.md's crates/services split. Takes a plain `sqlx::PgPool`
//! rather than nID's `core::db::DbPool` wrapper.

pub mod sms;

use anyhow::{anyhow, Result};
use chrono::Utc;
use newax_proto::identity_events::v1::CustomerEvent;
use nid_shared_types::{generate_session_token, sha256_hex};
use rand::Rng;
use sqlx::{FromRow, PgPool, Row};
use tracing::info;

/// Publishes a customer identity-change event (COMMUNICATION.md section 1,
/// async path; `op` is "created"/"updated"/"deleted"). `customer_id` here
/// is nID's `Account.id` — COMMUNICATION.md's ownership table treats a
/// person's identity as nID's regardless of which module first saw them.
/// Fire-and-forget — see `newax-event-bus`'s doc comment.
async fn publish_customer_event(op: &str, account: &AccountRow, deleted: bool) {
    let event = CustomerEvent {
        event_id: uuid::Uuid::new_v4().to_string(),
        occurred_at: chrono::Utc::now().to_rfc3339(),
        id: account.id.clone(),
        phone: Some(account.phone.clone()),
        email: account.email.clone(),
        name: account.name.clone(),
        deleted,
    };
    newax_event_bus::publisher()
        .await
        .publish(newax_event_bus::subjects::customer(op), &event)
        .await;
}

const OTP_CODE_LENGTH: usize = 6;
const OTP_TTL_MINUTES: i64 = 10;
const SESSION_TTL_DAYS: i64 = 30;
const MAX_OTP_ATTEMPTS: i32 = 5;
const OTP_RESEND_COOLDOWN_SECONDS: i64 = 30;

#[derive(Debug, Clone, FromRow)]
pub struct AccountRow {
    pub id: String,
    pub phone: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub phone_verified_at: Option<chrono::DateTime<chrono::Utc>>,
    pub email_verified_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone)]
pub struct AccountResponse {
    pub id: String,
    pub phone: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub phone_verified_at: Option<String>,
    pub email_verified_at: Option<String>,
}

impl From<AccountRow> for AccountResponse {
    fn from(row: AccountRow) -> Self {
        Self {
            id: row.id,
            phone: row.phone,
            email: row.email,
            name: row.name,
            phone_verified_at: row.phone_verified_at.map(|dt| dt.to_rfc3339()),
            email_verified_at: row.email_verified_at.map(|dt| dt.to_rfc3339()),
        }
    }
}

const BCRYPT_COST: u32 = bcrypt::DEFAULT_COST;

#[derive(Debug, Clone)]
pub struct VerifyOtpResponse {
    pub session_token: String,
    pub account: AccountResponse,
}

pub struct AccountsService {
    db: PgPool,
}

impl AccountsService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn start_otp(&self, phone: &str, otp_sms_dev_mode: bool) -> Result<()> {
        let outstanding: Option<(f64,)> = sqlx::query_as(
            r#"
            SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) as elapsed
            FROM account_otp_code
            WHERE phone = $1 AND consumed_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(phone)
        .fetch_optional(&self.db)
        .await?;

        if let Some((elapsed,)) = outstanding {
            if elapsed < OTP_RESEND_COOLDOWN_SECONDS as f64 {
                return Err(anyhow!("Please wait before requesting another code."));
            }
        }

        let code = {
            let mut rng = rand::thread_rng();
            format!("{:0width$}", rng.gen_range(0..10u32.pow(OTP_CODE_LENGTH as u32)), width = OTP_CODE_LENGTH)
        };
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
        .execute(&self.db)
        .await?;

        if otp_sms_dev_mode {
            info!("[accounts:dev] would send login code {} to {}", code, phone);
            return Ok(());
        }
        sms::SmsConfig::from_env()?
            .send(phone, &format!("Your nID login code is {code}. It expires in {OTP_TTL_MINUTES} minutes."))
            .await
    
    }

    pub async fn verify_otp(&self, phone: &str, code: &str) -> Result<VerifyOtpResponse> {
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
        .fetch_optional(&self.db)
        .await?;

        let challenge = challenge.ok_or_else(|| anyhow!("That code is incorrect or has expired."))?;
        let (challenge_id, code_hash, attempts) = challenge;

        if attempts >= MAX_OTP_ATTEMPTS {
            sqlx::query("UPDATE account_otp_code SET consumed_at = NOW() WHERE id = $1")
                .bind(&challenge_id)
                .execute(&self.db)
                .await?;
            return Err(anyhow!("Too many incorrect attempts. Request a new code."));
        }

        let submitted_hash = sha256_hex(code);
        if submitted_hash != code_hash {
            sqlx::query(
                "UPDATE account_otp_code SET attempts = attempts + 1 WHERE id = $1",
            )
            .bind(&challenge_id)
            .execute(&self.db)
            .await?;
            return Err(anyhow!("That code is incorrect or has expired."));
        }

        sqlx::query("UPDATE account_otp_code SET consumed_at = NOW() WHERE id = $1")
            .bind(&challenge_id)
            .execute(&self.db)
            .await?;

        let now = Utc::now();
        let account: AccountRow = sqlx::query_as(
            r#"
            INSERT INTO account (id, phone, phone_verified_at)
            VALUES (gen_random_uuid(), $1, $2)
            ON CONFLICT (phone)
            DO UPDATE SET phone_verified_at = $2
            RETURNING id, phone, email, name, phone_verified_at, email_verified_at
            "#,
        )
        .bind(phone)
        .bind(now)
        .fetch_one(&self.db)
        .await?;
        publish_customer_event("updated", &account, false).await;

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
        .execute(&self.db)
        .await?;

        Ok(VerifyOtpResponse {
            session_token: session.plaintext,
            account: account.into(),
        })
    }

    pub async fn get_account(&self, account_id: &str) -> Result<AccountResponse> {
        let account: AccountRow = sqlx::query_as(
            "SELECT id, phone, email, name, phone_verified_at, email_verified_at FROM account WHERE id = $1",
        )
        .bind(account_id)
        .fetch_one(&self.db)
        .await
        .map_err(|_| anyhow!("Account not found"))?;
        Ok(account.into())
    }

    pub async fn revoke_session(&self, token_hash: &str) -> Result<()> {
        sqlx::query("DELETE FROM account_session WHERE token_hash = $1")
            .bind(token_hash)
            .execute(&self.db)
            .await?;
        Ok(())
    }

    /// Erase an account (COMPLIANCE_AND_ACCESSIBILITY_RULES.md, deletion
    /// requests). The schema cascades the account's own data (profile and its
    /// images, sessions, grants, role and staff assignments) and nulls the
    /// references from tenant-owned records (subjects, organization
    /// memberships, OAuth requests), so tenants keep their records but they
    /// no longer point at this person. Login codes are keyed by phone and
    /// are removed here.
    pub async fn delete_account(&self, account_id: &str) -> Result<()> {
        let mut tx = self.db.begin().await?;
        let account: AccountRow = sqlx::query_as(
            "SELECT id, phone, email, name, phone_verified_at, email_verified_at FROM account WHERE id = $1",
        )
        .bind(account_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| anyhow!("Account not found"))?;
        sqlx::query("DELETE FROM account_otp_code WHERE phone = $1")
            .bind(&account.phone)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM account WHERE id = $1")
            .bind(account_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        publish_customer_event("deleted", &account, true).await;
        Ok(())
    }

    pub async fn revoke_all_sessions(&self, account_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM account_session WHERE account_id = $1")
            .bind(account_id)
            .execute(&self.db)
            .await?;
        Ok(())
    }

    pub async fn start_email_verification(&self, account_id: &str, email: &str, otp_sms_dev_mode: bool) -> Result<()> {
        sqlx::query("SELECT id FROM account WHERE id = $1")
            .bind(account_id)
            .fetch_one(&self.db)
            .await
            .map_err(|_| anyhow!("Account not found"))?;

        let outstanding: Option<(f64,)> = sqlx::query_as(
            "SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) as elapsed
             FROM account_otp_code
             WHERE phone = $1 AND consumed_at IS NULL
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(email)
        .fetch_optional(&self.db)
        .await?;

        if let Some((elapsed,)) = outstanding {
            if elapsed < OTP_RESEND_COOLDOWN_SECONDS as f64 {
                return Err(anyhow!("Please wait before requesting another code."));
            }
        }

        let code = {
            let mut rng = rand::thread_rng();
            format!("{:0width$}", rng.gen_range(0..10u32.pow(OTP_CODE_LENGTH as u32)), width = OTP_CODE_LENGTH)
        };
        let code_hash = sha256_hex(&code);
        let expires_at = Utc::now() + chrono::Duration::minutes(OTP_TTL_MINUTES);

        sqlx::query(
            "INSERT INTO account_otp_code (id, phone, code_hash, expires_at)
             VALUES (gen_random_uuid(), $1, $2, $3)",
        )
        .bind(email)
        .bind(&code_hash)
        .bind(expires_at)
        .execute(&self.db)
        .await?;

        if !otp_sms_dev_mode {
            return Err(anyhow!(
                "Account email verification has no production email vendor wired up yet"
            ));
        }

        info!("[accounts:dev] would send email verification code {} to {}", code, email);
        Ok(())
    }

    pub async fn verify_email(&self, account_id: &str, code: &str) -> Result<AccountResponse> {
        let email: String = sqlx::query_scalar(
            "SELECT email FROM account WHERE id = $1",
        )
        .bind(account_id)
        .fetch_one(&self.db)
        .await
        .map_err(|_| anyhow!("Account not found or email not set"))?;

        let challenge: Option<(String, String, i32)> = sqlx::query_as(
            "SELECT id, code_hash, attempts
             FROM account_otp_code
             WHERE phone = $1 AND consumed_at IS NULL AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(&email)
        .fetch_optional(&self.db)
        .await?;

        let challenge = challenge.ok_or_else(|| anyhow!("That code is incorrect or has expired."))?;
        let (challenge_id, code_hash, attempts) = challenge;

        if attempts >= MAX_OTP_ATTEMPTS {
            sqlx::query("UPDATE account_otp_code SET consumed_at = NOW() WHERE id = $1")
                .bind(&challenge_id)
                .execute(&self.db)
                .await?;
            return Err(anyhow!("Too many incorrect attempts. Request a new code."));
        }

        let submitted_hash = sha256_hex(code);
        if submitted_hash != code_hash {
            sqlx::query(
                "UPDATE account_otp_code SET attempts = attempts + 1 WHERE id = $1",
            )
            .bind(&challenge_id)
            .execute(&self.db)
            .await?;
            return Err(anyhow!("That code is incorrect or has expired."));
        }

        sqlx::query("UPDATE account_otp_code SET consumed_at = NOW() WHERE id = $1")
            .bind(&challenge_id)
            .execute(&self.db)
            .await?;

        let account: AccountRow = sqlx::query_as(
            "UPDATE account SET email_verified_at = NOW() WHERE id = $1
             RETURNING id, phone, email, name, phone_verified_at, email_verified_at",
        )
        .bind(account_id)
        .fetch_one(&self.db)
        .await?;

        Ok(account.into())
    }

    /// Detailed sign-up: name + email + phone + password, as an alternative
    /// to the passwordless phone+OTP flow above. Creates the Account but
    /// does not sign it in -- `login` is the separate step for that,
    /// mirroring how OTP sign-up and sign-in are two separate requests too.
    pub async fn register(
        &self,
        name: &str,
        email: &str,
        phone: &str,
        password: &str,
    ) -> Result<AccountResponse> {
        let existing: Option<(String,)> =
            sqlx::query_as("SELECT id FROM account WHERE phone = $1 OR email = $2")
                .bind(phone)
                .bind(email)
                .fetch_optional(&self.db)
                .await?;
        if existing.is_some() {
            return Err(anyhow!("An account with this phone or email already exists."));
        }

        let password_hash = bcrypt::hash(password, BCRYPT_COST)
            .map_err(|e| anyhow!("Could not process that password: {e}"))?;

        let account: AccountRow = sqlx::query_as(
            r#"
            INSERT INTO account (id, phone, email, name, password_hash)
            VALUES (gen_random_uuid(), $1, $2, $3, $4)
            RETURNING id, phone, email, name, phone_verified_at, email_verified_at
            "#,
        )
        .bind(phone)
        .bind(email)
        .bind(name)
        .bind(&password_hash)
        .fetch_one(&self.db)
        .await?;
        publish_customer_event("created", &account, false).await;

        Ok(account.into())
    }

    /// Password sign-in -- the counterpart to `register`. Only ever
    /// succeeds for an Account that has a password set (i.e. was created
    /// via `register`, not via phone+OTP).
    pub async fn login(&self, email: &str, password: &str) -> Result<VerifyOtpResponse> {
        let row: Option<(String, Option<String>)> =
            sqlx::query_as("SELECT id, password_hash FROM account WHERE email = $1")
                .bind(email)
                .fetch_optional(&self.db)
                .await?;

        let (account_id, password_hash) =
            row.ok_or_else(|| anyhow!("Invalid email or password."))?;
        let password_hash = password_hash.ok_or_else(|| anyhow!("Invalid email or password."))?;

        let matches = bcrypt::verify(password, &password_hash)
            .map_err(|e| anyhow!("Could not verify that password: {e}"))?;
        if !matches {
            return Err(anyhow!("Invalid email or password."));
        }

        let account: AccountRow = sqlx::query_as(
            "SELECT id, phone, email, name, phone_verified_at, email_verified_at FROM account WHERE id = $1",
        )
        .bind(&account_id)
        .fetch_one(&self.db)
        .await?;

        let session = generate_session_token();
        let expires_at = Utc::now() + chrono::Duration::days(SESSION_TTL_DAYS);
        sqlx::query(
            r#"
            INSERT INTO account_session (id, account_id, token_hash, expires_at)
            VALUES (gen_random_uuid(), $1, $2, $3)
            "#,
        )
        .bind(&account_id)
        .bind(&session.hash)
        .bind(expires_at)
        .execute(&self.db)
        .await?;

        Ok(VerifyOtpResponse {
            session_token: session.plaintext,
            account: account.into(),
        })
    }
}
