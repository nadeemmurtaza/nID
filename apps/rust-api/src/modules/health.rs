//! Health check module — liveness and readiness probes.

use axum::{Router, routing::get, Json};
use serde::Serialize;

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    service: String,
}

pub fn health_router() -> Router {
    Router::new()
        .route("/health", get(health_check))
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        service: "nID-rust-api".to_string(),
    })
}
