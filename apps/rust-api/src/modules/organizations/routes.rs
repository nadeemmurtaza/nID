//! Route registration for organizations endpoints.

use axum::{Router, routing::{get, post}};
use std::sync::Arc;

use super::handlers::{self, OrganizationsState};

pub fn organizations_router() -> Router<Arc<OrganizationsState>> {
    Router::new()
        .route("/v1/organizations/:tenantId/:apiKeyId", post(handlers::create))
        .route("/v1/organizations/:tenantId", get(handlers::list_all))
        .route("/v1/organizations/:tenantId/:id", get(handlers::get_by_id))
        .route("/v1/organizations/:tenantId/:id/memberships", get(handlers::list_memberships))
        .route("/v1/organizations/:tenantId/:apiKeyId/:id/memberships", post(handlers::invite_member))
        .route("/v1/organizations/:tenantId/:id/beneficial-owners", get(handlers::list_beneficial_owners))
        // Account-session endpoints
        .route("/v1/organizations/my-memberships/:accountId", get(handlers::list_my_memberships))
        .route("/v1/organizations/invites/mine/:accountId", get(handlers::list_my_invites))
        .route("/v1/organizations/invites/:membershipId/accept/:accountId", post(handlers::accept_invite))
        .route("/v1/organizations/invites/:membershipId/decline/:accountId", post(handlers::decline_invite))
}
