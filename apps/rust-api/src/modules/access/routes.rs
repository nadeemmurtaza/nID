//! Route registration for access control endpoints.
//!
//! Mounts all /v1/access/* routes under the Axum router.

use axum::{Router, routing::{get, post, put, delete, patch}};
use std::sync::Arc;

use super::handlers::{self, AccessState};

/// Build the access router with all /v1/access/* endpoints.
pub fn access_router() -> Router<Arc<AccessState>> {
    Router::new()
        .route("/v1/access/grant", post(handlers::create_grant))
        .route("/v1/access/grants", get(handlers::list_grants))
        .route("/v1/access/grant/:id", get(handlers::get_grant))
        .route("/v1/access/grant/:id", patch(handlers::update_grant))
        .route("/v1/access/grant/:id", delete(handlers::revoke_grant))
        .route("/v1/access/transfer-ownership", post(handlers::transfer_ownership))
        .route("/v1/access/partner", post(handlers::add_partner))
        .route("/v1/access/my-permissions", get(handlers::get_my_permissions))
}
