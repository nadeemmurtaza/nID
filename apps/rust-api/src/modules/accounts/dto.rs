//! Request/Response DTOs for accounts endpoints.

use serde::{Deserialize, Serialize};

/// Request body for POST /v1/accounts/otp/start
#[derive(Debug, Deserialize)]
pub struct StartOtpRequest {
    pub phone: String,
}

/// Request body for POST /v1/accounts/otp/verify
#[derive(Debug, Deserialize)]
pub struct VerifyOtpRequest {
    pub phone: String,
    pub code: String,
}

/// Response from OTP verify endpoint
#[derive(Debug, Serialize)]
pub struct VerifyOtpResponse {
    pub session_token: String,
    pub account: AccountResponse,
}

/// Request body for POST /v1/accounts/me/email/start
#[derive(Debug, Deserialize)]
pub struct StartEmailVerificationRequest {
    pub email: String,
}

/// Request body for POST /v1/accounts/me/email/verify
#[derive(Debug, Deserialize)]
pub struct VerifyEmailRequest {
    pub code: String,
}

/// Account in API responses
#[derive(Debug, Clone, Serialize)]
pub struct AccountResponse {
    pub id: String,
    pub phone: String,
    pub email: Option<String>,
    pub phone_verified_at: Option<String>,
    pub email_verified_at: Option<String>,
}

/// Generic accepted response
#[derive(Debug, Serialize)]
pub struct AcceptedResponse {
    pub accepted: bool,
}
