//! Brands handlers.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::sync::Arc;

use crate::modules::brands::dto::{BrandMembershipResponse, BrandResponse, CreateBrandRequest, MessageResponse, UpdateBrandRequest};
use crate::modules::brands::service::BrandsService;

pub struct BrandsState {
    pub service: BrandsService,
}

fn error_response(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let msg = err.to_string();
    let status = if msg.contains("not found") {
        StatusCode::NOT_FOUND
    } else {
        tracing::error!(error = %err, "Internal error");
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "message": msg })))
}

pub async fn create(
    Path((tenant_id, api_key_id)): Path<(String, String)>,
    State(state): State<Arc<BrandsState>>,
    Json(req): Json<CreateBrandRequest>,
) -> Result<Json<BrandResponse>, (StatusCode, Json<serde_json::Value>)> {
    let brand = state.service.create(&tenant_id, &api_key_id, &req).await.map_err(error_response)?;
    Ok(Json(brand))
}

pub async fn list_all(
    Path(tenant_id): Path<String>,
    State(state): State<Arc<BrandsState>>,
) -> Result<Json<Vec<BrandResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let brands = state.service.list_all(&tenant_id).await.map_err(error_response)?;
    Ok(Json(brands))
}

pub async fn get_by_slug(
    Path((tenant_id, slug)): Path<(String, String)>,
    State(state): State<Arc<BrandsState>>,
) -> Result<Json<BrandResponse>, (StatusCode, Json<serde_json::Value>)> {
    let brand = state.service.get_by_slug(&tenant_id, &slug).await.map_err(error_response)?;
    Ok(Json(brand))
}

/// GET /v1/brands/:tenantId/:id — get by ID
pub async fn get_by_id(
    Path((tenant_id, id)): Path<(String, String)>,
    State(state): State<Arc<BrandsState>>,
) -> Result<Json<BrandResponse>, (StatusCode, Json<serde_json::Value>)> {
    let brand = state.service.get_by_id(&tenant_id, &id).await.map_err(error_response)?;
    Ok(Json(brand))
}

/// PATCH /v1/brands/:tenantId/:apiKeyId/:id — update a brand
pub async fn update(
    Path((tenant_id, api_key_id, id)): Path<(String, String, String)>,
    State(state): State<Arc<BrandsState>>,
    Json(req): Json<UpdateBrandRequest>,
) -> Result<Json<BrandResponse>, (StatusCode, Json<serde_json::Value>)> {
    let brand = state.service.update(&tenant_id, &api_key_id, &id, &req).await.map_err(error_response)?;
    Ok(Json(brand))
}

/// DELETE /v1/brands/:tenantId/:apiKeyId/:id — deactivate a brand
pub async fn remove(
    Path((tenant_id, api_key_id, id)): Path<(String, String, String)>,
    State(state): State<Arc<BrandsState>>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<serde_json::Value>)> {
    let msg = state.service.remove(&tenant_id, &api_key_id, &id).await.map_err(error_response)?;
    Ok(Json(msg))
}

/// GET /v1/brands/my-memberships/:accountId — list brands the account works with
pub async fn list_my_memberships(
    Path(account_id): Path<String>,
    State(state): State<Arc<BrandsState>>,
) -> Result<Json<Vec<BrandMembershipResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let memberships = state.service.list_my_memberships(&account_id).await.map_err(error_response)?;
    Ok(Json(memberships))
}
