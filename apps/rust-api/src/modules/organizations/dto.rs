//! Request/Response DTOs for organizations endpoints.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateOrganizationRequest {
    pub subject_id: String,
    pub legal_name: String,
    #[serde(default)]
    pub registration_number: Option<String>,
    #[serde(default)]
    pub country_code: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrganizationRequest {
    #[serde(default)]
    pub legal_name: Option<String>,
    #[serde(default)]
    pub registration_number: Option<Option<String>>,
    #[serde(default)]
    pub country_code: Option<Option<String>>,
    #[serde(default)]
    pub address: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
pub struct InviteMemberRequest {
    pub phone: String,
    #[serde(default)]
    pub role: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrganizationResponse {
    pub id: String,
    pub tenant_id: String,
    pub subject_id: String,
    pub legal_name: String,
    pub registration_number: Option<String>,
    pub country_code: Option<String>,
    pub address: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MembershipResponse {
    pub id: String,
    pub tenant_id: String,
    pub organization_id: String,
    pub subject_id: String,
    pub role: String,
    pub status: String,
    pub phone: Option<String>,
    pub account_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BeneficialOwnerResponse {
    pub id: String,
    pub tenant_id: String,
    pub organization_id: String,
    pub person_subject_id: String,
    pub role: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}
