//! Profiles routes — mirrors apps/api/src/modules/profiles/profiles.controller.ts.

use axum::{Router, routing::{get, post, patch, delete}};
use std::sync::Arc;

use super::handlers::{self, ProfilesState};

pub fn profiles_router() -> Router<Arc<ProfilesState>> {
    Router::new()
        .route("/v1/profiles", post(handlers::create))
        .route("/v1/profiles/me", get(handlers::get_mine))
        .route("/v1/profiles/me", patch(handlers::update))
        .route("/v1/profiles/me/grants", post(handlers::create_grant))
        .route("/v1/profiles/me/grants", get(handlers::list_grants))
        .route("/v1/profiles/me/grants/{id}", delete(handlers::revoke_grant))
        // Public profile by slug — must stay declared after the /me routes
        // above, mirroring the TS controller's own ordering comment.
        .route("/v1/profiles/{slug}", get(handlers::get_public_by_slug))
}
