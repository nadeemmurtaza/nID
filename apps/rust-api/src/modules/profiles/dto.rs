//! Profiles DTOs — mirrors apps/api/src/modules/profiles/ DTOs.

use serde::{Deserialize, Serialize};

/// Request body for POST /v1/profiles
#[derive(Debug, Deserialize)]
pub struct CreateProfileRequest {
    pub slug: String,
    pub display_name: String,
    #[serde(default)]
    pub headline: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub bio: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub whatsapp: Option<String>,
    #[serde(default)]
    pub public_email: Option<String>,
    #[serde(default)]
    pub address_line1: Option<String>,
    #[serde(default)]
    pub address_line2: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    #[serde(default)]
    pub region: Option<String>,
    #[serde(default)]
    pub country_code: Option<String>,
    #[serde(default)]
    pub latitude: Option<f64>,
    #[serde(default)]
    pub longitude: Option<f64>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub show_phone: Option<bool>,
    #[serde(default)]
    pub show_whatsapp: Option<bool>,
    #[serde(default)]
    pub show_email: Option<bool>,
    #[serde(default)]
    pub show_address: Option<bool>,
    #[serde(default)]
    pub show_badges: Option<bool>,
    #[serde(default)]
    pub show_booking: Option<bool>,
    #[serde(default)]
    pub show_offers: Option<bool>,
    #[serde(default)]
    pub show_hours: Option<bool>,
    #[serde(default)]
    pub show_real_name: Option<bool>,
    #[serde(default)]
    pub is_published: Option<bool>,
}

/// Request body for PATCH /v1/profiles/me
#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub headline: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub bio: Option<Option<String>>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub whatsapp: Option<String>,
    #[serde(default)]
    pub public_email: Option<String>,
    #[serde(default)]
    pub address_line1: Option<String>,
    #[serde(default)]
    pub address_line2: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    #[serde(default)]
    pub region: Option<String>,
    #[serde(default)]
    pub country_code: Option<String>,
    #[serde(default)]
    pub latitude: Option<f64>,
    #[serde(default)]
    pub longitude: Option<f64>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub show_phone: Option<bool>,
    #[serde(default)]
    pub show_whatsapp: Option<bool>,
    #[serde(default)]
    pub show_email: Option<bool>,
    #[serde(default)]
    pub show_address: Option<bool>,
    #[serde(default)]
    pub show_badges: Option<bool>,
    #[serde(default)]
    pub show_booking: Option<bool>,
    #[serde(default)]
    pub show_offers: Option<bool>,
    #[serde(default)]
    pub show_hours: Option<bool>,
    #[serde(default)]
    pub show_real_name: Option<bool>,
    #[serde(default)]
    pub is_published: Option<bool>,
}

/// Request body for POST /v1/profiles/me/grants
#[derive(Debug, Deserialize)]
pub struct CreateGrantRequest {
    pub grantee_slug: String,
    pub field: String,
}

/// Profile field grant response
#[derive(Debug, Clone, Serialize)]
pub struct ProfileFieldGrantResponse {
    pub id: String,
    pub profile_id: String,
    pub field: String,
    pub grantee_account_id: Option<String>,
    pub grantee_organization_id: Option<String>,
    pub created_at: String,
    pub revoked_at: Option<String>,
}

/// Full profile response (owner view)
#[derive(Debug, Clone, Serialize)]
pub struct ProfileResponse {
    pub id: String,
    pub account_id: Option<String>,
    pub organization_id: Option<String>,
    pub slug: String,
    pub display_name: String,
    pub headline: Option<String>,
    pub category: String,
    pub bio: Option<String>,
    pub photo_key: Option<String>,
    pub phone: Option<String>,
    pub whatsapp: Option<String>,
    pub public_email: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub region: Option<String>,
    pub country_code: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub timezone: String,
    pub show_phone: bool,
    pub show_whatsapp: bool,
    pub show_email: bool,
    pub show_address: bool,
    pub show_badges: bool,
    pub show_booking: bool,
    pub show_offers: bool,
    pub show_hours: bool,
    pub show_real_name: bool,
    pub is_published: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Badge entry in public profile response
#[derive(Debug, Clone, Serialize)]
pub struct BadgeEntry {
    pub claim_type: String,
    pub level: String,
    pub verified_at: Option<String>,
    pub case_id: Option<String>,
}

/// Public profile response (viewer sees only what's exposed)
#[derive(Debug, Clone, Serialize)]
pub struct PublicProfileResponse {
    pub id: String,
    pub slug: String,
    pub display_name: String,
    pub headline: Option<String>,
    pub category: String,
    pub bio: Option<String>,
    pub photo_key: Option<String>,
    pub timezone: String,
    pub phone: Option<String>,
    pub whatsapp: Option<String>,
    pub public_email: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub region: Option<String>,
    pub country_code: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub show_booking: bool,
    pub show_offers: bool,
    pub show_hours: bool,
    pub badges: Option<Vec<BadgeEntry>>,
    pub real_name: Option<String>,
    pub phone_verified: bool,
    pub whatsapp_verified: bool,
}
