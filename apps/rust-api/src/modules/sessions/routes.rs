//! Sessions routes.

use axum::{Router, routing::get};
use std::sync::Arc;

use super::handlers::{self, SessionsState};

pub fn sessions_router() -> Router<Arc<SessionsState>> {
    Router::new()
        .route("/v1/sessions/:token/status", get(handlers::get_status))
}
