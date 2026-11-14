//! API key authentication — replaces ApiKeyGuard from TypeScript.
//!
//! Extracts the authenticated tenant from `Authorization: Bearer <apiKey>`.
//! Mirrors `apps/api/src/core/auth/api-key.guard.ts`.

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use sqlx::FromRow;

use crate::core::auth::types::AuthenticatedTenant;
use crate::core::db::DbPool;

/// An API key resolved from a valid Bearer token.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct AuthenticatedApiKey {
    pub id: String,
    pub tenant_id: String,
    pub key_prefix: String,
    pub scopes: Vec<String>,
}

/// Error response for authentication failures.
#[derive(Serialize)]
struct AuthError {
    message: String,
}

impl<B> FromRequestParts<B> for AuthenticatedApiKey
where
    B: Send + Sync,
{
    type Rejection = (StatusCode, Json<AuthError>);

    async fn from_request_parts(parts: &Parts, _state: &B) -> Result<Self, Self::Rejection> {
        let db = parts
            .extensions
            .get::<DbPool>()
            .ok_or_else(|| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(AuthError {
                        message: "Database not configured".to_string(),
                    }),
                )
            })?;

        let auth_header = parts
            .headers
            .get("authorization")
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(AuthError {
                        message: "Missing or malformed Authorization header".to_string(),
                    }),
                )
            })?
            .to_str()
            .map_err(|_| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(AuthError {
                        message: "Missing or malformed Authorization header".to_string(),
                    }),
                )
            })?;

        if !auth_header.starts_with("Bearer ") {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(AuthError {
                    message: "Missing or malformed Authorization header".to_string(),
                }),
            ));
        }

        let plaintext = auth_header["Bearer ".len()..].trim();
        if plaintext.is_empty() {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(AuthError {
                    message: "Missing API key".to_string(),
                }),
            ));
        }

        // Hash the API key and look it up
        let key_hash = nid_shared_types::hash_api_key(plaintext);

        let conn = db.get().await.map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthError {
                    message: "Database error".to_string(),
                }),
            )
        })?;

        let api_key: AuthenticatedApiKey = sqlx::query_as(
            r#"
            SELECT id, tenant_id, key_prefix, scopes
            FROM tenant_api_key
            WHERE key_hash = $1 AND revoked_at IS NULL
            "#,
        )
        .bind(&key_hash)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(AuthError {
                    message: "Invalid or revoked API key".to_string(),
                }),
            )
        })?;

        Ok(api_key)
    }
}
