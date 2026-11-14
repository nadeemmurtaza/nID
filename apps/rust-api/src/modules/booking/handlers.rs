//! HTTP handlers for booking endpoints.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::booking::dto::{
    AppointmentResponse, AvailabilityRuleResponse, CreateAppointmentRequest,
    CreateAvailabilityRuleRequest, CreateServiceRequest, MessageResponse,
    ServiceResponse, UpdateServiceRequest,
};
use crate::modules::booking::service::BookingService;

pub struct BookingState {
    pub service: BookingService,
    pub env: AppEnv,
}

// ── Owner endpoints (services) ──

/// POST /v1/profiles/me/services
pub async fn create_service(
    State(state): State<Arc<BookingState>>,
    Json(req): Json<CreateServiceRequest>,
) -> Result<Json<ServiceResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let service = state.service.create_service(&account_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(service))
}

/// GET /v1/profiles/me/services
pub async fn list_my_services(
    State(state): State<Arc<BookingState>>,
) -> Result<Json<Vec<ServiceResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let services = state.service.list_my_services(&account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(services))
}

/// PATCH /v1/profiles/me/services/:id
pub async fn update_service(
    Path(id): Path<String>,
    State(state): State<Arc<BookingState>>,
    Json(req): Json<UpdateServiceRequest>,
) -> Result<Json<ServiceResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let service = state.service.update_service(&account_id, &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(service))
}

/// DELETE /v1/profiles/me/services/:id
pub async fn remove_service(
    Path(id): Path<String>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    state.service.remove_service(&account_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Service removed.".to_string(),
    }))
}

// ── Owner endpoints (availability) ──

/// POST /v1/profiles/me/availability-rules
pub async fn create_availability_rule(
    State(state): State<Arc<BookingState>>,
    Json(req): Json<CreateAvailabilityRuleRequest>,
) -> Result<Json<AvailabilityRuleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let rule = state.service.create_availability_rule(&account_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(rule))
}

/// GET /v1/profiles/me/availability-rules
pub async fn list_my_availability_rules(
    State(state): State<Arc<BookingState>>,
) -> Result<Json<Vec<AvailabilityRuleResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let rules = state.service.list_my_availability_rules(&account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(rules))
}

/// DELETE /v1/profiles/me/availability-rules/:id
pub async fn remove_availability_rule(
    Path(id): Path<String>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    state.service.remove_availability_rule(&account_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Availability rule removed.".to_string(),
    }))
}

// ── Owner endpoints (appointments) ──

/// GET /v1/profiles/me/appointments
pub async fn list_my_appointments(
    State(state): State<Arc<BookingState>>,
) -> Result<Json<Vec<AppointmentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let appointments = state.service.list_my_appointments(&account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(appointments))
}

/// POST /v1/profiles/me/appointments/:id/confirm
pub async fn confirm_appointment(
    Path(id): Path<String>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<AppointmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let appt = state.service.confirm_appointment(&account_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(appt))
}

/// POST /v1/profiles/me/appointments/:id/cancel
pub async fn cancel_appointment(
    Path(id): Path<String>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<AppointmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let appt = state.service.cancel_appointment(&account_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(appt))
}

// ── Public endpoints ──

/// GET /v1/profiles/:slug/services
pub async fn list_public_services(
    Path(slug): Path<String>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<Vec<ServiceResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let services = state.service.list_public_services(&slug)
        .await
        .map_err(not_found)?;
    Ok(Json(services))
}

/// POST /v1/profiles/:slug/appointments
pub async fn create_public_appointment(
    Path(slug): Path<String>,
    State(state): State<Arc<BookingState>>,
    Json(req): Json<CreateAppointmentRequest>,
) -> Result<Json<AppointmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let appt = state.service.create_public_appointment(&slug, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(appt))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %err, "Internal error");
    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "message": err.to_string() })))
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    if err.to_string().contains("not found") {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({ "message": err.to_string() })))
    } else {
        internal_error(err)
    }
}
