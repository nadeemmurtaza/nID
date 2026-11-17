//! Brands DTOs.
//!
//! Mirrors `apps/api/src/modules/brands/brands.service.ts`'s CreateBrandDto / UpdateBrandDto.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct CreateBrandRequest {
    pub organization_id: String,
    pub name: String,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub bio: Option<String>,
    #[serde(default)]
    pub logo_key: Option<String>,
    #[serde(default)]
    pub primary_color: Option<String>,
    #[serde(default)]
    pub secondary_color: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub social_links: Option<HashMap<String, String>>,
    #[serde(default)]
    pub products: Option<serde_json::Value>,
    #[serde(default)]
    pub services: Option<serde_json::Value>,
    #[serde(default)]
    pub prices: Option<serde_json::Value>,
    #[serde(default)]
    pub policies: Option<serde_json::Value>,
    #[serde(default)]
    pub rules: Option<serde_json::Value>,
    #[serde(default)]
    pub tone_guidelines: Option<String>,
    #[serde(default)]
    pub keywords: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
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
    pub logo_key: Option<String>,
    #[serde(default)]
    pub primary_color: Option<String>,
    #[serde(default)]
    pub secondary_color: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub social_links: Option<HashMap<String, String>>,
    #[serde(default)]
    pub products: Option<serde_json::Value>,
    #[serde(default)]
    pub services: Option<serde_json::Value>,
    #[serde(default)]
    pub prices: Option<serde_json::Value>,
    #[serde(default)]
    pub policies: Option<serde_json::Value>,
    #[serde(default)]
    pub rules: Option<serde_json::Value>,
    #[serde(default)]
    pub tone_guidelines: Option<String>,
    #[serde(default)]
    pub keywords: Option<Vec<String>>,
    #[serde(default)]
    pub active: Option<bool>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct ListBrandsQuery {
    pub organization_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandResponse {
    pub id: String,
    pub organization_id: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub bio: Option<String>,
    pub logo_key: Option<String>,
    pub primary_color: Option<String>,
    pub secondary_color: Option<String>,
    pub website: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub social_links: Option<serde_json::Value>,
    pub products: Option<serde_json::Value>,
    pub services: Option<serde_json::Value>,
    pub prices: Option<serde_json::Value>,
    pub policies: Option<serde_json::Value>,
    pub rules: Option<serde_json::Value>,
    pub tone_guidelines: Option<serde_json::Value>,
    pub keywords: Option<serde_json::Value>,
    pub active: bool,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandMembershipResponse {
    pub brand_id: String,
    pub brand_name: String,
    pub brand_slug: String,
    pub organization_id: String,
    pub organization_name: String,
    pub tenant_id: String,
    pub tenant_name: String,
    pub role: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub message: String,
}
