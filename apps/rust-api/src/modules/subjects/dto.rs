//! Request/Response DTOs for subjects endpoints.

use serde::{Deserialize, Serialize};

/// Subject type (PERSON or ORGANIZATION)
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SubjectType {
    Person,
    Organization,
}

/// Request body for POST /v1/subjects
#[derive(Debug, Deserialize)]
pub struct CreateSubjectRequest {
    pub r#type: SubjectType,
    #[serde(default)]
    pub external_ref: Option<String>,
    #[serde(default)]
    pub given_name: Option<String>,
    #[serde(default)]
    pub family_name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub date_of_birth: Option<String>,
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
}

/// Subject in API responses
#[derive(Debug, Clone, Serialize)]
pub struct SubjectResponse {
    pub id: String,
    pub tenant_id: String,
    pub external_ref: Option<String>,
    pub r#type: String,
    pub given_name: Option<String>,
    pub family_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub date_of_birth: Option<String>,
    pub national_id_number: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub region: Option<String>,
    pub country_code: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub account_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Badge for a single ClaimType (strongest APPROVED case)
#[derive(Debug, Clone, Serialize)]
pub struct BadgeResponse {
    pub claim_type: String,
    pub level: String,
    pub verified_at: Option<String>,
    pub case_id: Option<String>,
}

/// Badges response: one badge per ClaimType
#[derive(Debug, Serialize)]
pub struct BadgesResponse {
    pub subject_id: String,
    pub badges: Vec<BadgeResponse>,
}

/// Attribute badge for a single AttributeType
#[derive(Debug, Clone, Serialize)]
pub struct AttributeBadgeResponse {
    pub attribute: String,
    pub level: String,
    pub verified_at: Option<String>,
    pub case_id: Option<String>,
    pub method: String,
}

/// Attribute badges response: one badge per AttributeType
#[derive(Debug, Serialize)]
pub struct AttributeBadgesResponse {
    pub subject_id: String,
    pub badges: Vec<AttributeBadgeResponse>,
}
