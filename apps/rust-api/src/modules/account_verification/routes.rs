//! Route registration for account verification endpoints.

use axum::{Router, routing::{get, post}};
use std::sync::Arc;

use super::handlers::{self, AccountVerificationState};

pub fn account_verification_router() -> Router<Arc<AccountVerificationState>> {
    Router::new()
        .route("/v1/accounts/me/verification", get(handlers::get_status))
        .route("/v1/accounts/me/verification/cases", post(handlers::create_case))
        .route("/v1/accounts/me/verification/cases", get(handlers::list_cases))
        .route("/v1/accounts/me/verification/cases/:id", get(handlers::get_case))
}
