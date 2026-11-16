//! Health check module: liveness and readiness probes.

use axum::{extract::Extension, http::StatusCode, routing::get, Json, Router};
use serde::Serialize;

use crate::core::db::DbPool;

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    service: String,
    database: String,
}

pub fn health_router() -> Router {
    Router::new().route("/health", get(health_check))
}

/// Readiness, not just liveness: a process that cannot reach Postgres
/// reports 503 so a load balancer routes around it.
async fn health_check(Extension(db): Extension<DbPool>) -> (StatusCode, Json<HealthResponse>) {
    let db_ok = tokio::time::timeout(
        std::time::Duration::from_secs(2),
        sqlx::query("SELECT 1").execute(db.inner()),
    )
    .await
    .map(|r| r.is_ok())
    .unwrap_or(false);

    let (code, status, database) = if db_ok {
        (StatusCode::OK, "ok", "ok")
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, "degraded", "unreachable")
    };
    (
        code,
        Json(HealthResponse {
            status: status.to_string(),
            service: "nID-rust-api".to_string(),
            database: database.to_string(),
        }),
    )
}
