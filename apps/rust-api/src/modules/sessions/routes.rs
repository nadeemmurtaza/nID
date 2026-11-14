//! Sessions routes — mirrors apps/api/src/modules/sessions/sessions.controller.ts.

use axum::{Router, routing::{get, post}};
use std::sync::Arc;

use super::handlers::{self, SessionsState};

pub fn sessions_router() -> Router<Arc<SessionsState>> {
    Router::new()
        .route("/v1/sessions/:token/status", get(handlers::get_status))
        .route("/v1/sessions/:token/otp/submit", post(handlers::submit_otp))
        .route("/v1/sessions/:token/document/submit", post(handlers::submit_document))
        .route("/v1/sessions/:token/liveness/submit", post(handlers::submit_liveness))
        .route("/v1/sessions/:token/claims/:method/submit", post(handlers::submit_claim_document))
        .route("/v1/sessions/:token/claims/:method/report", post(handlers::submit_self_report))
        .route("/v1/sessions/:token/claims/:method/code", post(handlers::submit_code))
        .route("/v1/sessions/:token/claims/:method/location", post(handlers::submit_location))
}
