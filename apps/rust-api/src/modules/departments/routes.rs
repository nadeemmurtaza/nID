//! Route registration for departments endpoints.

use axum::{Router, routing::{get, post, delete, patch}};
use std::sync::Arc;

use super::handlers::{self, DepartmentsState};

pub fn departments_router() -> Router<Arc<DepartmentsState>> {
    Router::new()
        .route("/v1/departments", post(handlers::create))
        .route("/v1/departments", get(handlers::list))
        .route("/v1/departments/:id", get(handlers::get))
        .route("/v1/departments/:id", patch(handlers::update))
        .route("/v1/departments/:id/assign", post(handlers::assign))
        .route("/v1/departments/:id/assign/:accountId", delete(handlers::remove_assignment))
        .route("/v1/departments/account/:accountId", get(handlers::get_account_departments))
}
