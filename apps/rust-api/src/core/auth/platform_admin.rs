//! Platform-admin authentication — replaces PlatformAdminGuard from TypeScript.
//!
//! Checks a shared secret in `Authorization: Bearer <PLATFORM_ADMIN_SECRET>`.
//! Mirrors `apps/api/src/core/auth/platform-admin.guard.ts`.

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::Json;

use crate::core::auth::session::AuthError;
use crate::core::config::AppEnv;

/// Marker extractor — presence of this type in a handler's signature means
/// the caller presented a valid platform admin secret.
#[derive(Debug, Clone)]
pub struct PlatformAdmin;

fn constant_time_compare(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut result = 0u8;
    for (x, y) in a.bytes().zip(b.bytes()) {
        result |= x ^ y;
    }
    result == 0
}

impl<B> FromRequestParts<B> for PlatformAdmin
where
    B: Send + Sync,
{
    type Rejection = (StatusCode, Json<AuthError>);

    async fn from_request_parts(parts: &mut Parts, _state: &B) -> Result<Self, Self::Rejection> {
        let unauthorized = |message: &str| {
            (
                StatusCode::UNAUTHORIZED,
                Json(AuthError {
                    message: message.to_string(),
                }),
            )
        };

        let env = parts
            .extensions
            .get::<AppEnv>()
            .ok_or_else(|| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(AuthError {
                        message: "Environment not configured".to_string(),
                    }),
                )
            })?;

        let header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| unauthorized("Missing or malformed Authorization header."))?;

        if !header.starts_with("Bearer ") {
            return Err(unauthorized("Missing or malformed Authorization header."));
        }

        let token = header["Bearer ".len()..].trim();
        if token.is_empty() {
            return Err(unauthorized("Missing platform admin secret."));
        }

        if !constant_time_compare(token, &env.platform_admin_secret) {
            return Err(unauthorized("Invalid platform admin secret."));
        }

        Ok(PlatformAdmin)
    }
}
