//! Structured error types for the nID API.
//!
//! Mirrors the NestJS exception filters and HTTP exception types.
//! Provides typed errors that map to proper HTTP status codes and JSON responses.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::Serialize;
use thiserror::Error;

/// A structured error response returned to the client as JSON.
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}

impl ErrorResponse {
    pub fn new(error: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            message: Some(message.into()),
            code: None,
        }
    }

    pub fn with_code(mut self, code: impl Into<String>) -> Self {
        self.code = Some(code.into());
        self
    }
}

/// The main error type for the nID API.
///
/// Maps to HTTP status codes and produces structured JSON error responses.
#[derive(Debug, Clone, Error)]
pub enum ApiError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Rate limited: {0}")]
    RateLimited(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let (status, error_type, message) = match &self {
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, "Not Found", msg.as_str()),
            ApiError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, "Unauthorized", msg.as_str()),
            ApiError::Forbidden(msg) => (StatusCode::FORBIDDEN, "Forbidden", msg.as_str()),
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "Bad Request", msg.as_str()),
            ApiError::Conflict(msg) => (StatusCode::CONFLICT, "Conflict", msg.as_str()),
            ApiError::Validation(msg) => (StatusCode::UNPROCESSABLE_ENTITY, "Validation Error", msg.as_str()),
            ApiError::RateLimited(msg) => (StatusCode::TOO_MANY_REQUESTS, "Rate Limited", msg.as_str()),
            ApiError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error", msg.as_str()),
            ApiError::ServiceUnavailable(msg) => (StatusCode::SERVICE_UNAVAILABLE, "Service Unavailable", msg.as_str()),
        };

        let body = Json(ErrorResponse {
            error: error_type.to_string(),
            message: Some(message.to_string()),
            code: None,
        });

        (status, body).into_response()
    }
}

/// Convert common error types to ApiError for ergonomic `?` usage.
impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => ApiError::NotFound("Requested resource not found".to_string()),
            sqlx::Error::Database(db_err) => {
                // Check for unique constraint violations
                if let Some(code) = db_err.code() {
                    if code == "23505" {
                        return ApiError::Conflict("A resource with this value already exists".to_string());
                    }
                }
                ApiError::Internal(format!("Database error: {}", db_err))
            }
            other => ApiError::Internal(format!("Database error: {}", other)),
        }
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        // Check if it's already an ApiError
        if let Some(api_err) = err.downcast_ref::<ApiError>() {
            return api_err.clone();
        }
        ApiError::Internal(format!("Internal error: {}", err))
    }
}

/// Turn an error from a module service (usually a gRPC status flattened into
/// an anyhow message) into an HTTP status and a message that is safe to show.
///
/// Domain errors keep their message and get a meaningful 4xx; anything that
/// looks like infrastructure (database, transport, tonic internals) is logged
/// in full and returned as a generic 500, so SQL and gRPC details never reach
/// a client.
pub fn http_error(err: anyhow::Error) -> (axum::http::StatusCode, axum::Json<serde_json::Value>) {
    use axum::http::StatusCode;

    let raw = err.to_string();
    // Pull the inner message out of "status: Code, message: \"...\", details: ..."
    let (code, msg) = match raw.find("status: ") {
        Some(i) => {
            let rest = &raw[i + "status: ".len()..];
            let code = rest.split(',').next().unwrap_or("").trim().to_string();
            let msg = rest
                .split_once("message: \"")
                .and_then(|(_, m)| m.split_once("\", details"))
                .map(|(m, _)| m.to_string())
                .unwrap_or_else(|| raw.clone());
            (code, msg)
        }
        None => (String::new(), raw.clone()),
    };

    let lower = msg.to_lowercase();
    let infra = ["error returned from database", "sqlstate", "relation \"", "connection refused", "transport error", "tonic", "unreachable", "pool timed out", "tcp connect"]
        .iter()
        .any(|k| lower.contains(k));

    let status = if infra {
        StatusCode::INTERNAL_SERVER_ERROR
    } else {
        match code.as_str() {
            "NotFound" => StatusCode::NOT_FOUND,
            "AlreadyExists" => StatusCode::CONFLICT,
            "InvalidArgument" | "FailedPrecondition" | "OutOfRange" => StatusCode::BAD_REQUEST,
            "PermissionDenied" => StatusCode::FORBIDDEN,
            "Unauthenticated" => StatusCode::UNAUTHORIZED,
            _ if lower.contains("not found") || lower.contains("no published profile") => StatusCode::NOT_FOUND,
            _ if lower.contains("already exists") || lower.contains("already ") => StatusCode::CONFLICT,
            _ if lower.contains("not allowed") || lower.contains("not authorized") || lower.contains("forbidden") || lower.contains("not staff") => StatusCode::FORBIDDEN,
            _ if lower.contains("must ") || lower.contains("invalid") || lower.contains("required") || lower.contains("not accepting") || lower.contains("not approved") || lower.contains("expired") => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    };

    if status == StatusCode::INTERNAL_SERVER_ERROR {
        tracing::error!(error = %raw, "Internal error");
        (status, axum::Json(serde_json::json!({ "message": "Internal server error" })))
    } else {
        (status, axum::Json(serde_json::json!({ "message": msg })))
    }
}
