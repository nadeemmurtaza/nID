//! DTOs for booking endpoints. Field names follow the frontend contract
//! (`apps/profile-ui/lib/owner-api.ts` and `lib/api.ts`).

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct CreateServiceRequest {
    pub name: String,
    pub duration_minutes: i32,
    #[serde(default)]
    pub price: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct UpdateServiceRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub duration_minutes: Option<i32>,
    #[serde(default)]
    pub price: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct CreateAvailabilityRuleRequest {
    pub day: String,
    pub start_minute: i32,
    pub end_minute: i32,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct UpdateAvailabilityRuleRequest {
    #[serde(default)]
    pub day: Option<String>,
    #[serde(default)]
    pub start_minute: Option<i32>,
    #[serde(default)]
    pub end_minute: Option<i32>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct CreateAppointmentRequest {
    pub service_id: String,
    pub starts_at: String,
    pub visitor_name: String,
    #[serde(default)]
    pub visitor_phone: Option<String>,
    #[serde(default)]
    pub visitor_email: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct AvailabilityQueryRequest {
    pub service_id: String,
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FreeSlotResponse {
    pub starts_at: String,
    pub ends_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceResponse {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub description: Option<String>,
    pub duration_minutes: i32,
    pub price: Option<f64>,
    pub currency: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailabilityRuleResponse {
    pub id: String,
    pub profile_id: String,
    pub day: String,
    pub start_minute: i32,
    pub end_minute: i32,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ServiceRef {
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppointmentResponse {
    pub id: String,
    pub profile_id: String,
    pub service_id: String,
    pub status: String,
    pub starts_at: String,
    pub ends_at: String,
    pub visitor_name: String,
    pub visitor_phone: Option<String>,
    pub visitor_email: Option<String>,
    pub notes: Option<String>,
    pub service: Option<ServiceRef>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub message: String,
}
