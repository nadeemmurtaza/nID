//! Route registration for tenants endpoints.
//!
//! Mounts all /v1/tenants/* routes under the Axum router.

use axum::{Router, routing::{get, post, put, delete}};
use std::sync::Arc;

use super::handlers::{self, TenantsState};

/// Build the tenants router with all /v1/tenants/* endpoints.
pub fn tenants_router() -> Router<Arc<TenantsState>> {
    Router::new()
        // Tenant-self
        .route("/v1/tenants/me/:actorType", get(handlers::get_self))
        // Account-session
        .route("/v1/tenants/my-memberships/:accountId", get(handlers::get_my_memberships))
        // Platform-admin
        .route("/v1/tenants", post(handlers::create))
        .route("/v1/tenants", get(handlers::list_all))
        .route("/v1/tenants/:id", get(handlers::get_by_id))
        .route("/v1/tenants/:id", put(handlers::update))
        // API keys
        .route("/v1/tenants/:id/api-keys", post(handlers::create_api_key))
        .route("/v1/tenants/:id/api-keys", get(handlers::list_api_keys))
        .route("/v1/tenants/:id/api-keys/:apiKeyId", delete(handlers::revoke_api_key))
        // Staff
        .route("/v1/tenants/:id/staff", post(handlers::invite_staff))
        .route("/v1/tenants/:id/staff", get(handlers::list_staff))
        .route("/v1/tenants/:id/staff/:accountId", delete(handlers::remove_staff))
}
