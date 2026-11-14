//! HTTP handlers for profile content endpoints.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::profile_content::dto::{
    BusinessHourResponse, ContactMessageResponse, CreateContactMessageRequest,
    CreateCustomLinkRequest, CreateOfferRequest, CreateSocialLinkRequest,
    CustomLinkResponse, MessageResponse, OfferResponse, SocialLinkResponse,
    UpsertBusinessHourRequest, UpdateOfferRequest,
};
use crate::modules::profile_content::service::ProfileContentService;

pub struct ProfileContentState {
    pub service: ProfileContentService,
    pub env: AppEnv,
}

// ── Offers (owner) ──

/// POST /v1/profiles/me/offers
pub async fn create_offer(
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<CreateOfferRequest>,
) -> Result<Json<OfferResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let offer = state.service.create_offer(&account_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(offer))
}

/// GET /v1/profiles/me/offers
pub async fn list_my_offers(
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<OfferResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let offers = state.service.list_my_offers(&account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(offers))
}

/// PATCH /v1/profiles/me/offers/:id
pub async fn update_offer(
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<UpdateOfferRequest>,
) -> Result<Json<OfferResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let offer = state.service.update_offer(&account_id, &id, &req)
        .await
        .map_err(not_found)?;
    Ok(Json(offer))
}

/// DELETE /v1/profiles/me/offers/:id
pub async fn remove_offer(
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    state.service.remove_offer(&account_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Offer removed.".to_string(),
    }))
}

// ── Business Hours (owner) ──

/// PUT /v1/profiles/me/business-hours/:day
pub async fn upsert_business_hour(
    Path(day): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<UpsertBusinessHourRequest>,
) -> Result<Json<BusinessHourResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let hour = state.service.upsert_business_hour(&account_id, &day, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(hour))
}

/// GET /v1/profiles/me/business-hours
pub async fn list_my_business_hours(
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<BusinessHourResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let hours = state.service.list_my_business_hours(&account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(hours))
}

/// DELETE /v1/profiles/me/business-hours/:day
pub async fn remove_business_hour(
    Path(day): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    state.service.remove_business_hour(&account_id, &day)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Business hour removed.".to_string(),
    }))
}

// ── Custom Links (owner) ──

/// POST /v1/profiles/me/links/custom
pub async fn create_custom_link(
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<CreateCustomLinkRequest>,
) -> Result<Json<CustomLinkResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let link = state.service.create_custom_link(&account_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(link))
}

/// GET /v1/profiles/me/links/custom
pub async fn list_my_custom_links(
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<CustomLinkResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let links = state.service.list_my_custom_links(&account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(links))
}

/// DELETE /v1/profiles/me/links/custom/:id
pub async fn remove_custom_link(
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    state.service.remove_custom_link(&account_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Link removed.".to_string(),
    }))
}

// ── Social Links (owner) ──

/// POST /v1/profiles/me/links/social
pub async fn create_social_link(
    State(state): State<Arc<ProfileContentState>>,
    Json(req): Json<CreateSocialLinkRequest>,
) -> Result<Json<SocialLinkResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let link = state.service.create_social_link(&account_id, &req)
        .await
        .map_err(internal_error)?;
    Ok(Json(link))
}

/// GET /v1/profiles/me/links/social
pub async fn list_my_social_links(
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<SocialLinkResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let links = state.service.list_my_social_links(&account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(links))
}

/// DELETE /v1/profiles/me/links/social/:id
pub async fn remove_social_link(
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    state.service.remove_social_link(&account_id, &id)
        .await
        .map_err(not_found)?;
    Ok(Json(MessageResponse {
        message: "Link removed.".to_string(),
    }))
}

// ── Contact Messages (owner) ──

/// GET /v1/profiles/me/contact-messages
pub async fn list_my_contact_messages(
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<Vec<ContactMessageResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let messages = state.service.list_my_contact_messages(&account_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(messages))
}

/// POST /v1/profiles/me/contact-messages/:id/read
pub async fn mark_contact_message_read(
    Path(id): Path<String>,
    State(state): State<Arc<ProfileContentState>>,
) -> Result<Json<ContactMessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let account_id = "account".to_string();
    let msg = state.service.mark_contact_message_read(&account_id, &id)
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

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %err, "Internal error");
    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "message": err.to_string() })))
}

fn not_found(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    if err.to_string().contains("not found") {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({ "message": err.to_string() })))
    } else {
        internal_error(err)
    }
}
