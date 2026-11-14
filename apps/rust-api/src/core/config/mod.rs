//! Environment configuration — mirrors `apps/api/src/core/config/env.ts`.
//!
//! Loads and validates all required environment variables at boot time.
//! Fail-fast: the server refuses to start if a required variable is missing.

use anyhow::{Context, Result};

/// Application environment configuration.
#[derive(Debug, Clone)]
pub struct AppEnv {
    /// Port the API listens on (default: 4000).
    pub api_port: u16,
    /// PostgreSQL connection string for the app role (RLS-enforced).
    pub app_database_url: String,
    /// Comma-separated list of allowed verification method providers.
    pub verification_methods: String,
    /// Dev mode: log OTP codes instead of sending SMS.
    pub otp_sms_dev_mode: bool,
    /// Base URL of apps/verify-ui for hosted verification flows.
    pub verify_ui_url: String,
    /// Session token TTL in minutes (default: 60).
    pub session_ttl_minutes: u32,
    /// Root directory for local-disk file storage (must be absolute).
    pub local_storage_dir: String,
    /// Dev mode: mock OCR results instead of calling a real vendor.
    pub document_ocr_dev_mode: bool,
    /// Dev mode: mock liveness results instead of calling a real vendor.
    pub liveness_dev_mode: bool,
    /// Shared secret for platform-admin operations (32+ chars).
    pub platform_admin_secret: String,
    /// Dev mode: log email verification codes instead of sending.
    pub account_email_dev_mode: bool,
}

impl AppEnv {
    /// Load environment variables, failing fast on missing required values.
    pub fn load() -> Result<Self> {
        Ok(Self {
            api_port: std::env::var("API_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(4000),
            app_database_url: required_env("APP_DATABASE_URL")?,
            verification_methods: std::env::var("VERIFICATION_METHODS").unwrap_or_default(),
            otp_sms_dev_mode: std::env::var("OTP_SMS_DEV_MODE").map_or(false, |v| v == "true"),
            verify_ui_url: std::env::var("VERIFY_UI_URL")
                .unwrap_or_else(|_| "http://localhost:3100".to_string()),
            session_ttl_minutes: std::env::var("SESSION_TTL_MINUTES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(60),
            local_storage_dir: required_env("LOCAL_STORAGE_DIR")?,
            document_ocr_dev_mode: std::env::var("DOCUMENT_OCR_DEV_MODE").map_or(false, |v| v == "true"),
            liveness_dev_mode: std::env::var("LIVENESS_DEV_MODE").map_or(false, |v| v == "true"),
            platform_admin_secret: std::env::var("PLATFORM_ADMIN_SECRET").unwrap_or_default(),
            account_email_dev_mode: std::env::var("ACCOUNT_EMAIL_DEV_MODE").map_or(false, |v| v == "true"),
        })
    }
}

/// Read a required environment variable, returning an error if missing.
fn required_env(name: &str) -> Result<String> {
    std::env::var(name).with_context(|| {
        format!(
            "Missing required env var {}. Copy .env.example to .env and fill it in.",
            name
        )
    })
}
