//! DTOs for profile content endpoints.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOfferRequest {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub valid_until: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOfferRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub valid_until: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertBusinessHourRequest {
    #[serde(default)]
    pub open_minute: Option<i32>,
    #[serde(default)]
    pub close_minute: Option<i32>,
    #[serde(default)]
    pub is_closed: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomLinkRequest {
    pub label: String,
    pub url: String,
    #[serde(default)]
    pub order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSocialLinkRequest {
    pub platform: String,
    pub url: String,
    #[serde(default)]
    pub order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCustomLinkRequest {
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSocialLinkRequest {
    #[serde(default)]
    pub platform: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadProfileImageRequest {
    #[serde(default)]
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileImageResponse {
    pub id: String,
    pub profile_id: String,
    pub kind: String,
    pub url: String,
    pub content_type: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContactMessageRequest {
    pub sender_name: String,
    #[serde(default)]
    pub sender_phone: Option<String>,
    #[serde(default)]
    pub sender_email: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfferResponse {
    pub id: String,
    pub profile_id: String,
    pub title: String,
    pub description: Option<String>,
    pub valid_until: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BusinessHourResponse {
    pub id: String,
    pub profile_id: String,
    pub day: String,
    pub open_minute: Option<i32>,
    pub close_minute: Option<i32>,
    pub is_closed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomLinkResponse {
    pub id: String,
    pub profile_id: String,
    pub label: String,
    pub url: String,
    pub order: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SocialLinkResponse {
    pub id: String,
    pub profile_id: String,
    pub platform: String,
    pub url: String,
    pub order: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactMessageResponse {
    pub id: String,
    pub profile_id: String,
    pub sender_name: String,
    pub sender_phone: Option<String>,
    pub sender_email: Option<String>,
    pub message: String,
    pub read_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub message: String,
}
