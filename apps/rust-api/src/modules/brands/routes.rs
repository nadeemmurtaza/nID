//! Brands routes.

use axum::{Router, routing::{get, post, patch, delete}};
use std::sync::Arc;

use super::handlers::{self, BrandsState};

pub fn brands_router() -> Router<Arc<BrandsState>> {
    Router::new()
        .route("/v1/brands/:tenantId/:apiKeyId", post(handlers::create))
        .route("/v1/brands/:tenantId", get(handlers::list_all))
        .route("/v1/brands/:tenantId/:slug", get(handlers::get_by_slug))
        .route("/v1/brands/:tenantId/:id", get(handlers::get_by_id))
        .route("/v1/brands/:tenantId/:apiKeyId/:id", patch(handlers::update))
        .route("/v1/brands/:tenantId/:apiKeyId/:id", delete(handlers::remove))
        .route("/v1/brands/my-memberships/:accountId", get(handlers::list_my_memberships))
}
