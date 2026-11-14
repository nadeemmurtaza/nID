//! DTOs for booking endpoints.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateServiceRequest {
    pub name: String,
    pub duration_minutes: i32,
    pub price_minor: i64,
    pub currency: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateServiceRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub duration_minutes: Option<i32>,
    #[serde(default)]
    pub price_minor: Option<i64>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAvailabilityRuleRequest {
    pub weekday: String,
    pub start_time: String,
    pub end_time: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateAppointmentRequest {
    pub service_id: String,
    pub start_time: String,
    #[serde(default)]
    pub subject_name: Option<String>,
    #[serde(default)]
    pub subject_email: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ServiceResponse {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub duration_minutes: i32,
    pub price_minor: i64,
    pub currency: String,
    pub description: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AvailabilityRuleResponse {
    pub id: String,
    pub profile_id: String,
    pub weekday: String,
    pub start_time: String,
    pub end_time: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppointmentResponse {
    pub id: String,
    pub profile_id: String,
    pub service_id: String,
    pub start_time: String,
    pub end_time: String,
    pub status: String,
    pub subject_name: Option<String>,
    pub subject_email: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}
