//! Profiles routes — mirrors apps/api/src/modules/profiles/profiles.controller.ts.

use axum::{Router, routing::{get, post, put, delete}};
use std::sync::Arc;

use super::handlers::{self, ProfilesState};

pub fn profiles_router() -> Router<Arc<ProfilesState>> {
    Router::new()
        // Owner endpoints
        .route("/v1/profiles/:accountId", post(handlers::create))
        .route("/v1/profiles/:accountId", get(handlers::get_mine))
        .route("/v1/profiles/:accountId", put(handlers::update))
        .route("/v1/profiles/:accountId/badges", get(handlers::get_badges))
        // Grants
        .route("/v1/profiles/:accountId/grants", post(handlers::create_grant))
        .route("/v1/profiles/:accountId/grants", get(handlers::list_grants))
        .route("/v1/profiles/:accountId/grants/:grantId", delete(handlers::revoke_grant))
        // Public profile by slug
        .route("/v1/profiles/:slug", get(handlers::get_public_by_slug))
}
