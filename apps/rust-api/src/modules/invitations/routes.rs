//! Route registration for invitations endpoints.

use axum::{Router, routing::{get, post, delete}};
use std::sync::Arc;

use super::handlers::{self, InvitationsState};

pub fn invitations_router() -> Router<Arc<InvitationsState>> {
    Router::new()
        .route("/v1/invitations/email", post(handlers::send_email_invite))
        .route("/v1/invitations/username", post(handlers::send_username_invite))
        .route("/v1/invitations/accept", post(handlers::accept_invitation))
        .route("/v1/invitations", get(handlers::list))
        .route("/v1/invitations/:id", delete(handlers::revoke))
}
