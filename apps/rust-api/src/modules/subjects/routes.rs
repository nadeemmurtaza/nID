//! Route registration for subjects endpoints.
//!
//! Mounts all /v1/subjects/* routes under the Axum router.

use axum::{Router, routing::{get, post}};
use std::sync::Arc;

use super::handlers::{self, SubjectsState};

/// Build the subjects router with all /v1/subjects/* endpoints.
pub fn subjects_router() -> Router<Arc<SubjectsState>> {
    Router::new()
        .route("/v1/subjects/:tenantId/:apiKeyId", post(handlers::create))
        .route("/v1/subjects/:tenantId/:apiKeyId/:id", get(handlers::get_by_id))
        .route("/v1/subjects/:tenantId/:actorType/:actorId/:id/badges", get(handlers::get_badges))
        .route("/v1/subjects/:tenantId/:actorType/:actorId/:id/attribute-badges", get(handlers::get_attribute_badges))
}
