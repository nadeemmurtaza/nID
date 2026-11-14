//! Route registration for tenant staff endpoints.

use axum::{Router, routing::{get, post}};
use std::sync::Arc;

use super::handlers::{self, TenantStaffState};

pub fn tenant_staff_router() -> Router<Arc<TenantStaffState>> {
    Router::new()
        .route("/v1/tenant-staff", post(handlers::invite))
        .route("/v1/tenant-staff", get(handlers::list))
}
