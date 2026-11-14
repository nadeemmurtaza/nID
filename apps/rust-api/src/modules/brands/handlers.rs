//! Brands handlers.
//!
//! Mirrors `apps/api/src/modules/brands/brands.controller.ts`.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::core::auth::session::AccountSession;
use crate::modules::brands::dto::{
    BrandMembershipResponse, BrandResponse, CreateBrandRequest, ListBrandsQuery, MessageResponse,
    UpdateBrandRequest,
};
use crate::modules::brands::service::BrandsService;

pub struct BrandsState {
    pub service: BrandsService,
}

fn error_response(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let msg = err.to_string();
    let status = if msg.contains("not found") {
        StatusCode::NOT_FOUND
    } else if msg.contains("already exists") {
        StatusCode::CONFLICT
    } else if msg.contains("not an admin") || msg.contains("not a member") {
        StatusCode::FORBIDDEN
    } else {
        tracing::error!(error = %err, "Internal error");
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": msg })))
}

/// POST /v1/brands
pub async fn create(
    account: AccountSession,
    State(state): State<Arc<BrandsState>>,
    Json(req): Json<CreateBrandRequest>,
) -> Result<Json<BrandResponse>, (StatusCode, Json<serde_json::Value>)> {
    let brand = state.service.create(&account.id, &req).await.map_err(error_response)?;
    Ok(Json(brand))
}

/// GET /v1/brands?organizationId=...
pub async fn list(
    account: AccountSession,
    Query(query): Query<ListBrandsQuery>,
    State(state): State<Arc<BrandsState>>,
) -> Result<Json<Vec<BrandResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let brands = state.service.list(&account.id, &query.organization_id).await.map_err(error_response)?;
    Ok(Json(brands))
}

/// GET /v1/brands/:id
pub async fn get_by_id(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<BrandsState>>,
) -> Result<Json<BrandResponse>, (StatusCode, Json<serde_json::Value>)> {
    let brand = state.service.get_by_id(&account.id, &id).await.map_err(error_response)?;
    Ok(Json(brand))
}

/// PATCH /v1/brands/:id
pub async fn update(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<BrandsState>>,
    Json(req): Json<UpdateBrandRequest>,
) -> Result<Json<BrandResponse>, (StatusCode, Json<serde_json::Value>)> {
    let brand = state.service.update(&account.id, &id, &req).await.map_err(error_response)?;
    Ok(Json(brand))
}

/// DELETE /v1/brands/:id
pub async fn remove(
    account: AccountSession,
    Path(id): Path<String>,
    State(state): State<Arc<BrandsState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let msg = state.service.remove(&account.id, &id).await.map_err(error_response)?;
    Ok(Json(msg))
}

/// GET /v1/brands/my-memberships
pub async fn list_my_memberships(
    account: AccountSession,
    State(state): State<Arc<BrandsState>>,
) -> Result<Json<Vec<BrandMembershipResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let memberships = state.service.list_my_memberships(&account.id).await.map_err(error_response)?;
    Ok(Json(memberships))
}
