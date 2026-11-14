//! Route registration for roles endpoints.

use axum::{Router, routing::{get, post, put, delete, patch}};
use std::sync::Arc;

use super::handlers::{self, RolesState};

pub fn roles_router() -> Router<Arc<RolesState>> {
    Router::new()
        .route("/v1/roles", post(handlers::create))
        .route("/v1/roles", get(handlers::list))
        .route("/v1/roles/:id", get(handlers::get))
        .route("/v1/roles/:id", patch(handlers::update))
        .route("/v1/roles/:id", delete(handlers::delete))
        .route("/v1/roles/:id/assign", post(handlers::assign))
        .route("/v1/roles/:id/assign/:accountId", delete(handlers::remove_assignment))
        .route("/v1/roles/account/:accountId", get(handlers::get_account_roles))
}
