//! Organization Profiles routes — mirrors apps/api/src/modules/profiles/organization-profiles.controller.ts.

use axum::{Router, routing::{get, post, patch, delete}};
use std::sync::Arc;

use super::handlers::{self, OrganizationProfilesState};

pub fn organization_profiles_router() -> Router<Arc<OrganizationProfilesState>> {
    Router::new()
        .route("/v1/organizations/:id/profile", post(handlers::create))
        .route("/v1/organizations/:id/profile", get(handlers::get))
        .route("/v1/organizations/:id/profile", patch(handlers::update))
        .route("/v1/organizations/:id/profile/grants", post(handlers::create_grant))
        .route("/v1/organizations/:id/profile/grants", get(handlers::list_grants))
        .route("/v1/organizations/:id/profile/grants/:grantId", delete(handlers::revoke_grant))
}
