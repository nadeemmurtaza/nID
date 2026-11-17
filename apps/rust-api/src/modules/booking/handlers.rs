//! HTTP handlers for booking endpoints.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::session::AccountSession;
use crate::core::config::AppEnv;
use crate::modules::booking::dto::{
    AppointmentResponse, AvailabilityQueryRequest, AvailabilityRuleResponse, CreateAppointmentRequest,
    CreateAvailabilityRuleRequest, CreateServiceRequest, FreeSlotResponse, MessageResponse,
    ServiceResponse, UpdateAvailabilityRuleRequest, UpdateServiceRequest,
};
use crate::modules::booking::service::BookingService;

pub struct BookingState {
    pub service: BookingService,
    pub env: AppEnv,
}

// ── Owner endpoints (services) ──

/// POST /v1/profiles/me/services
pub async fn create_service(
    account: AccountSession,
    State(state): State<Arc<BookingState>>,
    Json(req): Json<CreateServiceRequest>,
) -> Result<Json<ServiceResponse>, (StatusCode, Json<serde_json::Value>)> {
    let service = state.service.create_service(&account.id, None, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(service))
}

/// GET /v1/profiles/me/services
pub async fn list_my_services(
    account: AccountSession,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<Vec<ServiceResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let services = state.service.list_my_services(&account.id, None)
        .await
        .map_err(internal_error)?;
    Ok(Json(services))
}

/// PATCH /v1/profiles/me/services/:id
pub async fn update_service(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<BookingState>>,
    Json(req): Json<UpdateServiceRequest>,
) -> Result<Json<ServiceResponse>, (StatusCode, Json<serde_json::Value>)> {
    let service = state.service.update_service(&account.id, None, &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(service))
}

/// DELETE /v1/profiles/me/services/:id
pub async fn remove_service(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_service(&account.id, None, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Service removed.".to_string(),
    }))
}

// ── Owner endpoints (availability) ──

/// POST /v1/profiles/me/availability-rules
pub async fn create_availability_rule(
    account: AccountSession,
    State(state): State<Arc<BookingState>>,
    Json(req): Json<CreateAvailabilityRuleRequest>,
) -> Result<Json<AvailabilityRuleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let rule = state.service.create_availability_rule(&account.id, None, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(rule))
}

/// GET /v1/profiles/me/availability-rules
pub async fn list_my_availability_rules(
    account: AccountSession,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<Vec<AvailabilityRuleResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let rules = state.service.list_my_availability_rules(&account.id, None)
        .await
        .map_err(internal_error)?;
    Ok(Json(rules))
}

/// DELETE /v1/profiles/me/availability-rules/:id
pub async fn remove_availability_rule(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_availability_rule(&account.id, None, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Availability rule removed.".to_string(),
    }))
}

/// PATCH /v1/profiles/me/availability-rules/:id
pub async fn update_availability_rule(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<BookingState>>,
    Json(req): Json<UpdateAvailabilityRuleRequest>,
) -> Result<Json<AvailabilityRuleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let rule = state.service.update_availability_rule(&account.id, None, &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(rule))
}

// ── Owner endpoints (appointments) ──

/// GET /v1/profiles/me/appointments
pub async fn list_my_appointments(
    account: AccountSession,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<Vec<AppointmentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let appointments = state.service.list_my_appointments(&account.id, None)
        .await
        .map_err(internal_error)?;
    Ok(Json(appointments))
}

/// POST /v1/profiles/me/appointments/:id/confirm
pub async fn confirm_appointment(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<AppointmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let appt = state.service.confirm_appointment(&account.id, None, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(appt))
}

/// POST /v1/profiles/me/appointments/:id/cancel
pub async fn cancel_appointment(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<AppointmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let appt = state.service.cancel_appointment(&account.id, None, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(appt))
}

// ── Work endpoints (an organization's own services/availability/appointments) ──
// Mirror the owner endpoints above exactly, scoped to an organization's work
// profile instead of the caller's personal one -- see crates/booking's
// ProfileOwner::Organization (caller must be an ACTIVE admin member of a
// KYB-verified organization).

/// POST /v1/organizations/:orgId/profile/services
pub async fn create_org_service(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<BookingState>>,
    Json(req): Json<CreateServiceRequest>,
) -> Result<Json<ServiceResponse>, (StatusCode, Json<serde_json::Value>)> {
    let service = state.service.create_service(&account.id, Some(&org_id), &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(service))
}

/// GET /v1/organizations/:orgId/profile/services
pub async fn list_org_services(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<Vec<ServiceResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let services = state.service.list_my_services(&account.id, Some(&org_id))
        .await
        .map_err(internal_error)?;
    Ok(Json(services))
}

/// PATCH /v1/organizations/:orgId/profile/services/:id
pub async fn update_org_service(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<BookingState>>,
    Json(req): Json<UpdateServiceRequest>,
) -> Result<Json<ServiceResponse>, (StatusCode, Json<serde_json::Value>)> {
    let service = state.service.update_service(&account.id, Some(&org_id), &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(service))
}

/// DELETE /v1/organizations/:orgId/profile/services/:id
pub async fn remove_org_service(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_service(&account.id, Some(&org_id), &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Service removed.".to_string(),
    }))
}

/// POST /v1/organizations/:orgId/profile/availability-rules
pub async fn create_org_availability_rule(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<BookingState>>,
    Json(req): Json<CreateAvailabilityRuleRequest>,
) -> Result<Json<AvailabilityRuleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let rule = state.service.create_availability_rule(&account.id, Some(&org_id), &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(rule))
}

/// GET /v1/organizations/:orgId/profile/availability-rules
pub async fn list_org_availability_rules(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<Vec<AvailabilityRuleResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let rules = state.service.list_my_availability_rules(&account.id, Some(&org_id))
        .await
        .map_err(internal_error)?;
    Ok(Json(rules))
}

/// DELETE /v1/organizations/:orgId/profile/availability-rules/:id
pub async fn remove_org_availability_rule(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_availability_rule(&account.id, Some(&org_id), &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Availability rule removed.".to_string(),
    }))
}

/// PATCH /v1/organizations/:orgId/profile/availability-rules/:id
pub async fn update_org_availability_rule(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<BookingState>>,
    Json(req): Json<UpdateAvailabilityRuleRequest>,
) -> Result<Json<AvailabilityRuleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let rule = state.service.update_availability_rule(&account.id, Some(&org_id), &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(rule))
}

/// GET /v1/organizations/:orgId/profile/appointments
pub async fn list_org_appointments(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<Vec<AppointmentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let appointments = state.service.list_my_appointments(&account.id, Some(&org_id))
        .await
        .map_err(internal_error)?;
    Ok(Json(appointments))
}

/// POST /v1/organizations/:orgId/profile/appointments/:id/confirm
pub async fn confirm_org_appointment(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<AppointmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let appt = state.service.confirm_appointment(&account.id, Some(&org_id), &id)
        .await
        .map_err(not_found)?;
    Ok(Json(appt))
}

/// POST /v1/organizations/:orgId/profile/appointments/:id/cancel
pub async fn cancel_org_appointment(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<BookingState>>,
) -> Result<Json<AppointmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let appt = state.service.cancel_appointment(&account.id, Some(&org_id), &id)
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

/// GET /v1/profiles/:slug/availability
pub async fn get_public_availability(
    Path(slug): Path<String>,
    State(state): State<Arc<BookingState>>,
    Query(query): Query<AvailabilityQueryRequest>,
) -> Result<Json<Vec<FreeSlotResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let slots = state.service.compute_free_slots(&slug, &query.service_id, &query.from, &query.to)
        .await
        .map_err(not_found)?;
    Ok(Json(slots))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}
