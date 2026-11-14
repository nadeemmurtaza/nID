//! Brands routes.

use axum::{Router, routing::{get, post}};
use std::sync::Arc;

use super::handlers::{self, BrandsState};

pub fn brands_router() -> Router<Arc<BrandsState>> {
    Router::new()
        .route("/v1/brands/:tenantId/:apiKeyId", post(handlers::create))
        .route("/v1/brands/:tenantId", get(handlers::list_all))
        .route("/v1/brands/:tenantId/:slug", get(handlers::get_by_slug))
}
