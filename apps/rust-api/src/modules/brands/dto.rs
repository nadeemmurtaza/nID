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

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}
