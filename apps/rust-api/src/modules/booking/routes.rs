//! Route registration for booking endpoints.

use axum::{Router, routing::{get, post, delete, patch}};
use std::sync::Arc;

use super::handlers::{self, BookingState};

pub fn booking_router() -> Router<Arc<BookingState>> {
    Router::new()
        // Owner: services
        .route("/v1/profiles/me/services", post(handlers::create_service))
        .route("/v1/profiles/me/services", get(handlers::list_my_services))
        .route("/v1/profiles/me/services/{id}", patch(handlers::update_service))
        .route("/v1/profiles/me/services/{id}", delete(handlers::remove_service))
        // Owner: availability
        .route("/v1/profiles/me/availability-rules", post(handlers::create_availability_rule))
        .route("/v1/profiles/me/availability-rules", get(handlers::list_my_availability_rules))
        .route("/v1/profiles/me/availability-rules/{id}", patch(handlers::update_availability_rule))
        .route("/v1/profiles/me/availability-rules/{id}", delete(handlers::remove_availability_rule))
        // Owner: appointments
        .route("/v1/profiles/me/appointments", get(handlers::list_my_appointments))
        .route("/v1/profiles/me/appointments/{id}/confirm", post(handlers::confirm_appointment))
        .route("/v1/profiles/me/appointments/{id}/cancel", post(handlers::cancel_appointment))
        // Work: an organization's own services/availability/appointments --
        // same shape as the owner routes above, scoped to an organization's
        // work profile instead of the caller's personal one.
        .route("/v1/organizations/{orgId}/profile/services", post(handlers::create_org_service))
        .route("/v1/organizations/{orgId}/profile/services", get(handlers::list_org_services))
        .route("/v1/organizations/{orgId}/profile/services/{id}", patch(handlers::update_org_service))
        .route("/v1/organizations/{orgId}/profile/services/{id}", delete(handlers::remove_org_service))
        .route("/v1/organizations/{orgId}/profile/availability-rules", post(handlers::create_org_availability_rule))
        .route("/v1/organizations/{orgId}/profile/availability-rules", get(handlers::list_org_availability_rules))
        .route("/v1/organizations/{orgId}/profile/availability-rules/{id}", patch(handlers::update_org_availability_rule))
        .route("/v1/organizations/{orgId}/profile/availability-rules/{id}", delete(handlers::remove_org_availability_rule))
        .route("/v1/organizations/{orgId}/profile/appointments", get(handlers::list_org_appointments))
        .route("/v1/organizations/{orgId}/profile/appointments/{id}/confirm", post(handlers::confirm_org_appointment))
        .route("/v1/organizations/{orgId}/profile/appointments/{id}/cancel", post(handlers::cancel_org_appointment))
        // Public
        .route("/v1/profiles/{slug}/services", get(handlers::list_public_services))
        .route("/v1/profiles/{slug}/availability", get(handlers::get_public_availability))
        .route("/v1/profiles/{slug}/appointments", post(handlers::create_public_appointment))
}
