//! Structured error types for the nID API.
//!
//! Mirrors the NestJS exception filters and HTTP exception types.
//! Provides typed errors that map to proper HTTP status codes and JSON responses.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Json},
    Json as AxumJson,
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
#[derive(Debug, Error)]
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

        let body = Json(AxumJson(ErrorResponse {
            error: error_type.to_string(),
            message: Some(message.to_string()),
            code: None,
        }));

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
                ApiError::Internal(format!("Database error: {}", err))
            }
            _ => ApiError::Internal(format!("Database error: {}", err)),
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
