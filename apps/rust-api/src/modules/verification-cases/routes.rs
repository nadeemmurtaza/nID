//! Route registration for verification cases endpoints.
//!
//! Mounts all /v1/verification-cases/* routes under the Axum router.

use axum::{Router, routing::{get, post}};
use std::sync::Arc;

use super::handlers::{self, VerificationCasesState};

/// Build the verification cases router with all /v1/verification-cases/* endpoints.
pub fn verification_cases_router() -> Router<Arc<VerificationCasesState>> {
    Router::new()
        // Create and list
        .route("/v1/verification-cases/:tenantId/:apiKeyId", post(handlers::create))
        .route("/v1/verification-cases/:tenantId/:actorType/:actorId", get(handlers::list))
        // Get by ID
        .route("/v1/verification-cases/:tenantId/:actorType/:actorId/:id", get(handlers::get_by_id))
        // Resolve
        .route("/v1/verification-cases/:tenantId/:actorType/:actorId/:id/resolve", post(handlers::resolve))
        // OTP submission
        .route("/v1/verification-cases/:tenantId/:apiKeyId/:id/otp/submit", post(handlers::submit_otp))
        // Claim submissions
        .route("/v1/verification-cases/:tenantId/:apiKeyId/:id/claims/:method/report", post(handlers::submit_self_report))
        .route("/v1/verification-cases/:tenantId/:apiKeyId/:id/claims/:method/agent-attest", post(handlers::submit_agent_attestation))
        .route("/v1/verification-cases/:tenantId/:apiKeyId/:id/claims/:method/code", post(handlers::submit_code))
        .route("/v1/verification-cases/:tenantId/:apiKeyId/:id/claims/:method/location", post(handlers::submit_location))
}
