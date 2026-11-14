//! Route registration for permissions endpoints.

use axum::{Router, routing::get};
use std::sync::Arc;

use super::handlers::{self, PermissionsState};

pub fn permissions_router() -> Router<Arc<PermissionsState>> {
    Router::new()
        .route("/v1/permissions/catalog", get(handlers::get_catalog))
        .route("/v1/permissions/all", get(handlers::get_all))
        .route("/v1/permissions/group/:groupName", get(handlers::get_group))
}
