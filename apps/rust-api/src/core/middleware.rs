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

    let span = Span::current().record("request_id", &request_id);

    let _guard = span.enter();
    let start = std::time::Instant::now();

    let mut res = next.run(req).await;

    let elapsed = start.elapsed();
    let status = res.status();

    // Add request ID to response headers
    res.headers_mut().insert(
        REQUEST_ID_HEADER,
        request_id.parse().unwrap_or_default(),
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
