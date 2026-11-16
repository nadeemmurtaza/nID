//! DTOs for OAuth endpoints.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct CreateLoginRequestDto {
    pub client_id: String,
    pub redirect_uri: String,
    #[serde(default)]
    pub state: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct TokenExchangeDto {
    pub code: String,
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequestStatusResponse {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_in: Option<i64>,
}
