//! DTOs for profile content endpoints.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateOfferRequest {
    pub title: String,
    pub price_minor: i64,
    pub currency: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOfferRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub price_minor: Option<i64>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertBusinessHourRequest {
    pub start_time: String,
    pub end_time: String,
    #[serde(default)]
    pub is_closed: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateCustomLinkRequest {
    pub label: String,
    pub url: String,
    #[serde(default)]
    pub order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSocialLinkRequest {
    pub platform: String,
    pub username: String,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateContactMessageRequest {
    pub name: String,
    pub email: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct OfferResponse {
    pub id: String,
    pub profile_id: String,
    pub title: String,
    pub price_minor: i64,
    pub currency: String,
    pub description: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct BusinessHourResponse {
    pub id: String,
    pub profile_id: String,
    pub weekday: String,
    pub start_time: String,
    pub end_time: String,
    pub is_closed: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct CustomLinkResponse {
    pub id: String,
    pub profile_id: String,
    pub label: String,
    pub url: String,
    pub order: i32,
}

#[derive(Debug, Clone, Serialize)]
pub struct SocialLinkResponse {
    pub id: String,
    pub profile_id: String,
    pub platform: String,
    pub username: String,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ContactMessageResponse {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub email: String,
    pub message: String,
    pub is_read: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}
