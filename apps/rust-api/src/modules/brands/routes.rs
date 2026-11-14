//! Brands routes.
//!
//! Mirrors `apps/api/src/modules/brands/brands.controller.ts`.

use axum::{Router, routing::{get, post, patch, delete}};
use std::sync::Arc;

use super::handlers::{self, BrandsState};

pub fn brands_router() -> Router<Arc<BrandsState>> {
    Router::new()
        .route("/v1/brands", post(handlers::create))
        .route("/v1/brands", get(handlers::list))
        .route("/v1/brands/my-memberships", get(handlers::list_my_memberships))
        .route("/v1/brands/{id}", get(handlers::get_by_id))
        .route("/v1/brands/{id}", patch(handlers::update))
        .route("/v1/brands/{id}", delete(handlers::remove))
}
