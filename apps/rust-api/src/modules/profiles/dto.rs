//! Profiles DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub bio: Option<Option<String>>,
    #[serde(default)]
    pub avatar_url: Option<Option<String>>,
    #[serde(default)]
    pub website: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProfileResponse {
    pub id: String,
    pub account_id: String,
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub website: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
