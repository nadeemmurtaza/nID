//! Route registration for profile content endpoints.

use axum::{Router, routing::{get, post, put, delete, patch}};
use std::sync::Arc;

use super::handlers::{self, ProfileContentState};

pub fn profile_content_router() -> Router<Arc<ProfileContentState>> {
    Router::new()
        // Offers (owner)
        .route("/v1/profiles/me/offers", post(handlers::create_offer))
        .route("/v1/profiles/me/offers", get(handlers::list_my_offers))
        .route("/v1/profiles/me/offers/{id}", patch(handlers::update_offer))
        .route("/v1/profiles/me/offers/{id}", delete(handlers::remove_offer))
        // Business Hours (owner)
        .route("/v1/profiles/me/business-hours/{day}", put(handlers::upsert_business_hour))
        .route("/v1/profiles/me/business-hours", get(handlers::list_my_business_hours))
        .route("/v1/profiles/me/business-hours/{day}", delete(handlers::remove_business_hour))
        // Custom Links (owner)
        .route("/v1/profiles/me/links/custom", post(handlers::create_custom_link))
        .route("/v1/profiles/me/links/custom", get(handlers::list_my_custom_links))
        .route("/v1/profiles/me/links/custom/{id}", patch(handlers::update_custom_link))
        .route("/v1/profiles/me/links/custom/{id}", delete(handlers::remove_custom_link))
        // Social Links (owner)
        .route("/v1/profiles/me/links/social", post(handlers::create_social_link))
        .route("/v1/profiles/me/links/social", get(handlers::list_my_social_links))
        .route("/v1/profiles/me/links/social/{id}", patch(handlers::update_social_link))
        .route("/v1/profiles/me/links/social/{id}", delete(handlers::remove_social_link))
        // Profile Images (owner)
        .route("/v1/profiles/me/photo", post(handlers::upload_photo))
        .route("/v1/profiles/me/images", post(handlers::upload_gallery_image))
        .route("/v1/profiles/me/images", get(handlers::list_my_images))
        .route("/v1/profiles/me/images/{id}", delete(handlers::remove_image))
        // Contact Messages (owner)
        .route("/v1/profiles/me/contact-messages", get(handlers::list_my_contact_messages))
        .route("/v1/profiles/me/contact-messages/{id}/read", post(handlers::mark_contact_message_read))
        // Work: an organization's own offers/hours/links/images/messages --
        // same shape as the owner routes above, scoped to an organization's
        // work profile instead of the caller's personal one.
        .route("/v1/organizations/{orgId}/profile/offers", post(handlers::create_org_offer))
        .route("/v1/organizations/{orgId}/profile/offers", get(handlers::list_org_offers))
        .route("/v1/organizations/{orgId}/profile/offers/{id}", patch(handlers::update_org_offer))
        .route("/v1/organizations/{orgId}/profile/offers/{id}", delete(handlers::remove_org_offer))
        .route("/v1/organizations/{orgId}/profile/business-hours/{day}", put(handlers::upsert_org_business_hour))
        .route("/v1/organizations/{orgId}/profile/business-hours", get(handlers::list_org_business_hours))
        .route("/v1/organizations/{orgId}/profile/business-hours/{day}", delete(handlers::remove_org_business_hour))
        .route("/v1/organizations/{orgId}/profile/links/custom", post(handlers::create_org_custom_link))
        .route("/v1/organizations/{orgId}/profile/links/custom", get(handlers::list_org_custom_links))
        .route("/v1/organizations/{orgId}/profile/links/custom/{id}", patch(handlers::update_org_custom_link))
        .route("/v1/organizations/{orgId}/profile/links/custom/{id}", delete(handlers::remove_org_custom_link))
        .route("/v1/organizations/{orgId}/profile/links/social", post(handlers::create_org_social_link))
        .route("/v1/organizations/{orgId}/profile/links/social", get(handlers::list_org_social_links))
        .route("/v1/organizations/{orgId}/profile/links/social/{id}", patch(handlers::update_org_social_link))
        .route("/v1/organizations/{orgId}/profile/links/social/{id}", delete(handlers::remove_org_social_link))
        .route("/v1/organizations/{orgId}/profile/photo", post(handlers::upload_org_photo))
        .route("/v1/organizations/{orgId}/profile/images", post(handlers::upload_org_gallery_image))
        .route("/v1/organizations/{orgId}/profile/images", get(handlers::list_org_images))
        .route("/v1/organizations/{orgId}/profile/images/{id}", delete(handlers::remove_org_image))
        .route("/v1/organizations/{orgId}/profile/contact-messages", get(handlers::list_org_contact_messages))
        .route("/v1/organizations/{orgId}/profile/contact-messages/{id}/read", post(handlers::mark_org_contact_message_read))
        // Public
        .route("/v1/profiles/{slug}/offers", get(handlers::list_public_offers))
        .route("/v1/profiles/{slug}/business-hours", get(handlers::list_public_business_hours))
        .route("/v1/profiles/{slug}/links", get(handlers::list_public_links))
        .route("/v1/profiles/{slug}/images", get(handlers::list_public_images))
        .route("/v1/profiles/{slug}/photo", get(handlers::get_public_photo))
        .route("/v1/profiles/{slug}/images/{imageId}", get(handlers::get_public_image))
        .route("/v1/profiles/{slug}/contact-messages", post(handlers::create_public_contact_message))
}
