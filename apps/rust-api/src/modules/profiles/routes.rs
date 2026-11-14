//! Profiles routes.

use axum::{Router, routing::{get, put}};
use std::sync::Arc;

use super::handlers::{self, ProfilesState};

pub fn profiles_router() -> Router<Arc<ProfilesState>> {
    Router::new()
        .route("/v1/profiles/:accountId", get(handlers::get_by_account))
        .route("/v1/profiles/:accountId", put(handlers::update))
}
