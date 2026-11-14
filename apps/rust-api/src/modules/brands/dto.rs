//! Brands DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateBrandRequest {
    pub name: String,
    pub slug: String,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub primary_color: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrandResponse {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub slug: String,
    pub logo_url: Option<String>,
    pub primary_color: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBrandRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub bio: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub active: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrandMembershipResponse {
    pub brand_id: String,
    pub brand_name: String,
    pub brand_slug: String,
    pub organization_id: String,
    pub organization_name: String,
    pub tenant_id: String,
    pub role: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}
