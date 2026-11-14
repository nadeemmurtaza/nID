//! Organization Profiles DTOs — mirrors apps/api/src/modules/profiles/ DTOs for org profiles.

use serde::{Deserialize, Serialize};

/// Request body for POST /v1/organizations/:id/profile
#[derive(Debug, Deserialize)]
pub struct CreateOrgProfileRequest {
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
    pub is_published: Option<bool>,
}

/// Request body for PATCH /v1/organizations/:id/profile
#[derive(Debug, Deserialize)]
pub struct UpdateOrgProfileRequest {
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
    pub is_published: Option<bool>,
}

/// Request body for POST /v1/organizations/:id/profile/grants
#[derive(Debug, Deserialize)]
pub struct CreateOrgGrantRequest {
    pub grantee_slug: String,
    pub field: String,
}

/// Profile field grant response
#[derive(Debug, Clone, Serialize)]
pub struct OrgProfileFieldGrantResponse {
    pub id: String,
    pub profile_id: String,
    pub field: String,
    pub grantee_account_id: Option<String>,
    pub grantee_organization_id: Option<String>,
    pub created_at: String,
    pub revoked_at: Option<String>,
}

/// Organization profile response
#[derive(Debug, Clone, Serialize)]
pub struct OrgProfileResponse {
    pub id: String,
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
    pub is_published: bool,
    pub created_at: String,
    pub updated_at: String,
}
