//! HTTP handlers for profile content endpoints.

use axum::extract::{Path, Query, State, Multipart};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::session::AccountSession;
use crate::core::config::AppEnv;
use crate::core::upload::read_single_file;
use crate::modules::profile_content::dto::{
    BusinessHourResponse, ContactMessageResponse, CreateContactMessageRequest,
    CreateCustomLinkRequest, CreateOfferRequest, CreateSocialLinkRequest,
    CustomLinkResponse, MessageResponse, OfferResponse, ProfileImageResponse,
    SocialLinkResponse, UploadProfileImageRequest, UpsertBusinessHourRequest, UpdateCustomLinkRequest,
    UpdateOfferRequest, UpdateSocialLinkRequest,
};
use crate::modules::profile_content::service::ProfileContentService;

pub struct ProfileContentState {
    pub service: ProfileContentService,
    pub env: AppEnv,
}

// ── Offers (owner) ──

/// POST /v1/profiles/me/offers
pub async fn create_offer(
    account: AccountSession,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<CreateOfferRequest>,
) -> Result<Json<OfferResponse>, (StatusCode, Json<serde_json::Value>)> {
    let offer = state.service.create_offer(&account.id, None, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(offer))
}

/// GET /v1/profiles/me/offers
pub async fn list_my_offers(
    account: AccountSession,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<OfferResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let offers = state.service.list_my_offers(&account.id, None)
        .await
        .map_err(internal_error)?;
    Ok(Json(offers))
}

/// PATCH /v1/profiles/me/offers/:id
pub async fn update_offer(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<UpdateOfferRequest>,
) -> Result<Json<OfferResponse>, (StatusCode, Json<serde_json::Value>)> {
    let offer = state.service.update_offer(&account.id, None, &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(offer))
}

/// DELETE /v1/profiles/me/offers/:id
pub async fn remove_offer(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_offer(&account.id, None, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Offer removed.".to_string(),
    }))
}

// ── Offers (work) ──

/// POST /v1/organizations/:orgId/profile/offers
pub async fn create_org_offer(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<CreateOfferRequest>,
) -> Result<Json<OfferResponse>, (StatusCode, Json<serde_json::Value>)> {
    let offer = state.service.create_offer(&account.id, Some(&org_id), &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(offer))
}

/// GET /v1/organizations/:orgId/profile/offers
pub async fn list_org_offers(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<OfferResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let offers = state.service.list_my_offers(&account.id, Some(&org_id))
        .await
        .map_err(internal_error)?;
    Ok(Json(offers))
}

/// PATCH /v1/organizations/:orgId/profile/offers/:id
pub async fn update_org_offer(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<UpdateOfferRequest>,
) -> Result<Json<OfferResponse>, (StatusCode, Json<serde_json::Value>)> {
    let offer = state.service.update_offer(&account.id, Some(&org_id), &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(offer))
}

/// DELETE /v1/organizations/:orgId/profile/offers/:id
pub async fn remove_org_offer(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_offer(&account.id, Some(&org_id), &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Offer removed.".to_string(),
    }))
}

// ── Business Hours (owner) ──

/// PUT /v1/profiles/me/business-hours/:day
pub async fn upsert_business_hour(
    account: AccountSession,
    Path(day): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<UpsertBusinessHourRequest>,
) -> Result<Json<BusinessHourResponse>, (StatusCode, Json<serde_json::Value>)> {
    let hour = state.service.upsert_business_hour(&account.id, None, &day, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(hour))
}

/// GET /v1/profiles/me/business-hours
pub async fn list_my_business_hours(
    account: AccountSession,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<BusinessHourResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let hours = state.service.list_my_business_hours(&account.id, None)
        .await
        .map_err(internal_error)?;
    Ok(Json(hours))
}

/// DELETE /v1/profiles/me/business-hours/:day
pub async fn remove_business_hour(
    account: AccountSession,
    Path(day): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_business_hour(&account.id, None, &day)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Business hour removed.".to_string(),
    }))
}

// ── Business Hours (work) ──

/// PUT /v1/organizations/:orgId/profile/business-hours/:day
pub async fn upsert_org_business_hour(
    account: AccountSession,
    Path((org_id, day)): Path<(String, String)>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<UpsertBusinessHourRequest>,
) -> Result<Json<BusinessHourResponse>, (StatusCode, Json<serde_json::Value>)> {
    let hour = state.service.upsert_business_hour(&account.id, Some(&org_id), &day, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(hour))
}

/// GET /v1/organizations/:orgId/profile/business-hours
pub async fn list_org_business_hours(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<BusinessHourResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let hours = state.service.list_my_business_hours(&account.id, Some(&org_id))
        .await
        .map_err(internal_error)?;
    Ok(Json(hours))
}

/// DELETE /v1/organizations/:orgId/profile/business-hours/:day
pub async fn remove_org_business_hour(
    account: AccountSession,
    Path((org_id, day)): Path<(String, String)>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_business_hour(&account.id, Some(&org_id), &day)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Business hour removed.".to_string(),
    }))
}

// ── Custom Links (owner) ──

/// POST /v1/profiles/me/links/custom
pub async fn create_custom_link(
    account: AccountSession,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<CreateCustomLinkRequest>,
) -> Result<Json<CustomLinkResponse>, (StatusCode, Json<serde_json::Value>)> {
    let link = state.service.create_custom_link(&account.id, None, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(link))
}

/// GET /v1/profiles/me/links/custom
pub async fn list_my_custom_links(
    account: AccountSession,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<CustomLinkResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let links = state.service.list_my_custom_links(&account.id, None)
        .await
        .map_err(internal_error)?;
    Ok(Json(links))
}

/// DELETE /v1/profiles/me/links/custom/:id
pub async fn remove_custom_link(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_custom_link(&account.id, None, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Link removed.".to_string(),
    }))
}

/// PATCH /v1/profiles/me/links/custom/:id
pub async fn update_custom_link(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<UpdateCustomLinkRequest>,
) -> Result<Json<CustomLinkResponse>, (StatusCode, Json<serde_json::Value>)> {
    let link = state.service.update_custom_link(&account.id, None, &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(link))
}

// ── Custom Links (work) ──

/// POST /v1/organizations/:orgId/profile/links/custom
pub async fn create_org_custom_link(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<CreateCustomLinkRequest>,
) -> Result<Json<CustomLinkResponse>, (StatusCode, Json<serde_json::Value>)> {
    let link = state.service.create_custom_link(&account.id, Some(&org_id), &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(link))
}

/// GET /v1/organizations/:orgId/profile/links/custom
pub async fn list_org_custom_links(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<CustomLinkResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let links = state.service.list_my_custom_links(&account.id, Some(&org_id))
        .await
        .map_err(internal_error)?;
    Ok(Json(links))
}

/// DELETE /v1/organizations/:orgId/profile/links/custom/:id
pub async fn remove_org_custom_link(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_custom_link(&account.id, Some(&org_id), &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Link removed.".to_string(),
    }))
}

/// PATCH /v1/organizations/:orgId/profile/links/custom/:id
pub async fn update_org_custom_link(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<UpdateCustomLinkRequest>,
) -> Result<Json<CustomLinkResponse>, (StatusCode, Json<serde_json::Value>)> {
    let link = state.service.update_custom_link(&account.id, Some(&org_id), &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(link))
}

// ── Social Links (owner) ──

/// POST /v1/profiles/me/links/social
pub async fn create_social_link(
    account: AccountSession,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<CreateSocialLinkRequest>,
) -> Result<Json<SocialLinkResponse>, (StatusCode, Json<serde_json::Value>)> {
    let link = state.service.create_social_link(&account.id, None, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(link))
}

/// GET /v1/profiles/me/links/social
pub async fn list_my_social_links(
    account: AccountSession,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<SocialLinkResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let links = state.service.list_my_social_links(&account.id, None)
        .await
        .map_err(internal_error)?;
    Ok(Json(links))
}

/// DELETE /v1/profiles/me/links/social/:id
pub async fn remove_social_link(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_social_link(&account.id, None, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Link removed.".to_string(),
    }))
}

/// PATCH /v1/profiles/me/links/social/:id
pub async fn update_social_link(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<UpdateSocialLinkRequest>,
) -> Result<Json<SocialLinkResponse>, (StatusCode, Json<serde_json::Value>)> {
    let link = state.service.update_social_link(&account.id, None, &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(link))
}

// ── Social Links (work) ──

/// POST /v1/organizations/:orgId/profile/links/social
pub async fn create_org_social_link(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<CreateSocialLinkRequest>,
) -> Result<Json<SocialLinkResponse>, (StatusCode, Json<serde_json::Value>)> {
    let link = state.service.create_social_link(&account.id, Some(&org_id), &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(link))
}

/// GET /v1/organizations/:orgId/profile/links/social
pub async fn list_org_social_links(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<SocialLinkResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let links = state.service.list_my_social_links(&account.id, Some(&org_id))
        .await
        .map_err(internal_error)?;
    Ok(Json(links))
}

/// DELETE /v1/organizations/:orgId/profile/links/social/:id
pub async fn remove_org_social_link(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_social_link(&account.id, Some(&org_id), &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Link removed.".to_string(),
    }))
}

/// PATCH /v1/organizations/:orgId/profile/links/social/:id
pub async fn update_org_social_link(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<UpdateSocialLinkRequest>,
) -> Result<Json<SocialLinkResponse>, (StatusCode, Json<serde_json::Value>)> {
    let link = state.service.update_social_link(&account.id, Some(&org_id), &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(link))
}

// ── Profile Images (owner) ──

/// POST /v1/profiles/me/photo
pub async fn upload_photo(
    account: AccountSession,
    State(state): State<Arc<ProfileContentState>>,
    multipart: Multipart,
) -> Result<Json<ProfileImageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let file = read_single_file(multipart, "file").await.map_err(internal_error)?;
    let img = state.service.upload_photo(&account.id, None, file)
        .await
        .map_err(internal_error)?;
    Ok(Json(img))
}

/// POST /v1/profiles/me/images
pub async fn upload_gallery_image(
    account: AccountSession,
    Query(query): Query<UploadProfileImageRequest>,
    State(state): State<Arc<ProfileContentState>>,
    multipart: Multipart,
) -> Result<Json<ProfileImageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let file = read_single_file(multipart, "file").await.map_err(internal_error)?;
    let kind = query.kind.unwrap_or_else(|| "gallery".to_string());
    let img = state.service.upload_gallery_image(&account.id, None, &kind, file)
        .await
        .map_err(internal_error)?;
    Ok(Json(img))
}

/// GET /v1/profiles/me/images
pub async fn list_my_images(
    account: AccountSession,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<ProfileImageResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let images = state.service.list_my_images(&account.id, None)
        .await
        .map_err(internal_error)?;
    Ok(Json(images))
}

/// DELETE /v1/profiles/me/images/:id
pub async fn remove_image(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_image(&account.id, None, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Image removed.".to_string(),
    }))
}

// ── Profile Images (work) ──

/// POST /v1/organizations/:orgId/profile/photo
pub async fn upload_org_photo(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
    multipart: Multipart,
) -> Result<Json<ProfileImageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let file = read_single_file(multipart, "file").await.map_err(internal_error)?;
    let img = state.service.upload_photo(&account.id, Some(&org_id), file)
        .await
        .map_err(internal_error)?;
    Ok(Json(img))
}

/// POST /v1/organizations/:orgId/profile/images
pub async fn upload_org_gallery_image(
    account: AccountSession,
    Path(org_id): Path<String>,
    Query(query): Query<UploadProfileImageRequest>,
    State(state): State<Arc<ProfileContentState>>,
    multipart: Multipart,
) -> Result<Json<ProfileImageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let file = read_single_file(multipart, "file").await.map_err(internal_error)?;
    let kind = query.kind.unwrap_or_else(|| "gallery".to_string());
    let img = state.service.upload_gallery_image(&account.id, Some(&org_id), &kind, file)
        .await
        .map_err(internal_error)?;
    Ok(Json(img))
}

/// GET /v1/organizations/:orgId/profile/images
pub async fn list_org_images(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<ProfileImageResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let images = state.service.list_my_images(&account.id, Some(&org_id))
        .await
        .map_err(internal_error)?;
    Ok(Json(images))
}

/// DELETE /v1/organizations/:orgId/profile/images/:id
pub async fn remove_org_image(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    state.service.remove_image(&account.id, Some(&org_id), &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Image removed.".to_string(),
    }))
}

// ── Contact Messages (owner) ──

/// GET /v1/profiles/me/contact-messages
pub async fn list_my_contact_messages(
    account: AccountSession,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<ContactMessageResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let messages = state.service.list_my_contact_messages(&account.id, None)
        .await
        .map_err(internal_error)?;
    Ok(Json(messages))
}

/// POST /v1/profiles/me/contact-messages/:id/read
pub async fn mark_contact_message_read(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<ContactMessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let msg = state.service.mark_contact_message_read(&account.id, None, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(msg))
}

// ── Contact Messages (work) ──

/// GET /v1/organizations/:orgId/profile/contact-messages
pub async fn list_org_contact_messages(
    account: AccountSession,
    Path(org_id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<ContactMessageResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let messages = state.service.list_my_contact_messages(&account.id, Some(&org_id))
        .await
        .map_err(internal_error)?;
    Ok(Json(messages))
}

/// POST /v1/organizations/:orgId/profile/contact-messages/:id/read
pub async fn mark_org_contact_message_read(
    account: AccountSession,
    Path((org_id, id)): Path<(String, String)>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<ContactMessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let msg = state.service.mark_contact_message_read(&account.id, Some(&org_id), &id)
        .await
        .map_err(not_found)?;
    Ok(Json(msg))
}

// ── Public endpoints ──

/// GET /v1/profiles/:slug/offers
pub async fn list_public_offers(
    Path(slug): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<OfferResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let offers = state.service.list_public_offers(&slug)
        .await
        .map_err(not_found)?;
    Ok(Json(offers))
}

/// GET /v1/profiles/:slug/business-hours
pub async fn list_public_business_hours(
    Path(slug): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<BusinessHourResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let hours = state.service.list_public_business_hours(&slug)
        .await
        .map_err(not_found)?;
    Ok(Json(hours))
}

/// GET /v1/profiles/:slug/links
pub async fn list_public_links(
    Path(slug): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let (custom, social) = state.service.list_public_links(&slug)
        .await
        .map_err(not_found)?;
    Ok(Json(serde_json::json!({ "customLinks": custom, "socialLinks": social })))
}

/// POST /v1/profiles/:slug/contact-messages
pub async fn create_public_contact_message(
    Path(slug): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<CreateContactMessageRequest>,
) -> Result<Json<ContactMessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let msg = state.service.create_public_contact_message(&slug, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(msg))
}

/// GET /v1/profiles/:slug/images
pub async fn list_public_images(
    Path(slug): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<ProfileImageResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let images = state.service.list_public_images(&slug)
        .await
        .map_err(not_found)?;
    Ok(Json(images))
}

/// GET /v1/profiles/:slug/photo — get the public profile photo
pub async fn get_public_photo(
    Path(slug): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let (url, content_type) = state.service.get_public_photo(&slug)
        .await
        .map_err(not_found)?;
    Ok(Json(serde_json::json!({ "url": url, "contentType": content_type })))
}

/// GET /v1/profiles/:slug/images/:imageId — get a specific public gallery image
pub async fn get_public_image(
    Path((slug, image_id)): Path<(String, String)>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let (url, content_type) = state.service.get_public_image(&slug, &image_id)
        .await
        .map_err(not_found)?;
    Ok(Json(serde_json::json!({ "url": url, "contentType": content_type })))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    crate::core::error::http_error(err)
}
