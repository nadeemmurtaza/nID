//! Account session authentication — replaces AccountSessionGuard from TypeScript.
//!
//! Extracts the Account from `Authorization: Bearer <sessionToken>`.
//! Mirrors `apps/api/src/core/auth/account-session.guard.ts`.

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Serialize;
use sqlx::FromRow;

use crate::core::db::DbPool;

/// An account resolved from a valid session token.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct AccountSession {
    pub id: String,
    pub phone: String,
    pub email: Option<String>,
    pub phone_verified_at: Option<chrono::DateTime<chrono::Utc>>,
    pub email_verified_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Error response for authentication failures.
#[derive(Serialize)]
struct AuthError {
    message: String,
}

impl<B> FromRequestParts<B> for AccountSession
where
    B: Send + Sync,
{
    type Rejection = (StatusCode, Json<AuthError>);

    async fn from_request_parts(parts: &Parts, state: &B) -> Result<Self, Self::Rejection> {
        // This is a simplified version — in production, you'd use a proper
        // state extractor. For now, we extract from extensions.
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

        let token = auth_header["Bearer ".len()..].trim();
        if token.is_empty() {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(AuthError {
                    message: "Missing session token".to_string(),
                }),
            ));
        }

        // Hash the token and look up the session
        let token_hash = nid_shared_types::sha256_hex(token);

        let conn = db.get().await.map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthError {
                    message: "Database error".to_string(),
                }),
            )
        })?;

        let account: AccountSession = sqlx::query_as(
            r#"
            SELECT a.id, a.phone, a.email, a.phone_verified_at, a.email_verified_at
            FROM account_session s
            JOIN account a ON s.account_id = a.id
            WHERE s.token_hash = $1 AND s.expires_at > NOW()
            "#,
        )
        .bind(&token_hash)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(AuthError {
                    message: "Invalid or expired session".to_string(),
                }),
            )
        })?;

        Ok(account)
    }
}
