//! Middleware layer for request tracing, timing, and audit logging.
//!
//! Mirrors the NestJS interceptors and guards in apps/api/src/core/.

use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use uuid::Uuid;
use tracing::Span;

/// Request ID header name — shared between middleware and handlers.
pub const REQUEST_ID_HEADER: &str = "X-Request-Id";

/// Middleware that assigns a unique request ID and logs request timing.
///
/// Mirrors the NestJS logging interceptor. Each request gets a UUID in the
/// `X-Request-Id` header and a structured log entry with method, path, status,
/// and elapsed time.
pub async fn request_tracing(req: Request, next: Next) -> Response {
    let request_id = Uuid::new_v4().to_string();
    let method = req.method().clone();
    let uri = req.uri().clone();

    let span = Span::current();
    span.record("request_id", &request_id);

    let _guard = span.enter();
    let start = std::time::Instant::now();

    let mut res = next.run(req).await;

    let elapsed = start.elapsed();
    let status = res.status();

    // Add request ID to response headers
    res.headers_mut().insert(
        REQUEST_ID_HEADER,
        request_id.parse().unwrap_or_else(|_| axum::http::HeaderValue::from_static("unknown")),
    );

    // Log at different levels based on status
    if status.is_server_error() {
        tracing::error!(
            request_id = %request_id,
            method = %method,
            uri = %uri,
            status = status.as_u16(),
            elapsed_ms = elapsed.as_millis(),
            "Request completed with server error"
        );
    } else if status.is_client_error() {
        tracing::warn!(
            request_id = %request_id,
            method = %method,
            uri = %uri,
            status = status.as_u16(),
            elapsed_ms = elapsed.as_millis(),
            "Request completed with client error"
        );
    } else {
        tracing::info!(
            request_id = %request_id,
            method = %method,
            uri = %uri,
            status = status.as_u16(),
            elapsed_ms = elapsed.as_millis(),
            "Request completed"
        );
    }

    res
}

/// CORS origin validation middleware — SECURITY_RULES.md §8.
///
/// Rejects requests whose Origin header is not in the allowlist.
/// The allowlist is read from CORS_ALLOWED_ORIGINS env var at boot time.
pub async fn validate_cors_origin(req: Request, next: Next) -> Response {
    let allowed: Vec<String> = std::env::var("CORS_ALLOWED_ORIGINS")
        .ok()
        .map(|v| v.split(',').map(|s| s.trim().to_string()).collect())
        .unwrap_or_else(|| {
            vec![
                "http://localhost:3300".into(),
                "http://localhost:3100".into(),
                "http://localhost:3000".into(),
                "http://localhost:3200".into(),
            ]
        });

    // Only validate Origin header on preflight and cross-origin requests
    if let Some(origin) = req.headers().get(axum::http::header::ORIGIN) {
        if let Ok(origin_str) = origin.to_str() {
            if !allowed.contains(&origin_str.to_string()) {
                tracing::warn!(
                    origin = %origin_str,
                    "Rejected request from disallowed origin"
                );
                return Response::builder()
                    .status(axum::http::StatusCode::FORBIDDEN)
                    .header("Content-Type", "application/json")
                    .body(axum::body::Body::from(
                        serde_json::json!({ "message": "Origin not allowed" }).to_string(),
                    ))
                    .unwrap_or_else(|_| {
                        Response::new(axum::body::Body::from(""))
                    });
            }
        }
    }

    next.run(req).await
}
