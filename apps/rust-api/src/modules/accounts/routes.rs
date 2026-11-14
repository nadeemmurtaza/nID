//! Route registration for accounts endpoints.
//!
//! Mounts all /v1/accounts/* routes under the Axum router.

use axum::{Router, routing::{get, post}};
use std::sync::Arc;

use super::handlers::{self, AccountsState};

/// Build the accounts router with all /v1/accounts/* endpoints.
pub fn accounts_router() -> Router<Arc<AccountsState>> {
    Router::new()
        .route("/v1/accounts/otp/start", post(handlers::start_otp))
        .route("/v1/accounts/otp/verify", post(handlers::verify_otp))
        .route("/v1/accounts/me", get(handlers::me))
        .route("/v1/accounts/me/logout", post(handlers::logout))
        .route("/v1/accounts/me/logout-all", post(handlers::logout_all))
}
