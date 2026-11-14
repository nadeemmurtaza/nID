//! Route registration for OAuth endpoints.

use axum::{Router, routing::{get, post}};
use std::sync::Arc;

use super::handlers::{self, OAuthState};

pub fn oauth_router() -> Router<Arc<OAuthState>> {
    Router::new()
        .route("/v1/oauth/login-requests", post(handlers::create))
        .route("/v1/oauth/login-requests/:pollToken", get(handlers::status))
        .route("/v1/oauth/login-requests/:pollToken/approve", post(handlers::approve))
        .route("/v1/oauth/login-requests/:pollToken/claim", post(handlers::claim))
        .route("/v1/oauth/token", post(handlers::token))
}
