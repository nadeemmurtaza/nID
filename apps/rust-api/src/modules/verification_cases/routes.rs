//! Route registration for verification cases endpoints.
//!
//! Mounts all /v1/verification-cases/* routes under the Axum router.

use axum::{Router, routing::{get, post}};
use std::sync::Arc;

use super::handlers::{self, VerificationCasesState};

/// Build the verification cases router with all /v1/verification-cases/* endpoints.
pub fn verification_cases_router() -> Router<Arc<VerificationCasesState>> {
    Router::new()
        .route("/v1/verification-cases", post(handlers::create))
        .route("/v1/verification-cases", get(handlers::list))
        .route("/v1/verification-cases/{id}", get(handlers::get_by_id))
        .route("/v1/verification-cases/{id}/resolve", post(handlers::resolve))
        .route("/v1/verification-cases/{id}/otp/submit", post(handlers::submit_otp))
        .route("/v1/verification-cases/{id}/claims/{method}/report", post(handlers::submit_self_report))
        .route("/v1/verification-cases/{id}/claims/{method}/agent-attest", post(handlers::submit_agent_attestation))
        .route("/v1/verification-cases/{id}/claims/{method}/code", post(handlers::submit_code))
        .route("/v1/verification-cases/{id}/claims/{method}/location", post(handlers::submit_location))
}
