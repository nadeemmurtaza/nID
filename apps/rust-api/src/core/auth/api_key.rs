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

use crate::core::db::DbPool;

/// An API key resolved from a valid Bearer token.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct AuthenticatedApiKey {
    pub id: String,
    pub tenant_id: String,
    pub key_prefix: String,
    pub scopes: Vec<String>,
    #[serde(skip_serializing)]
    pub rate_limit_per_minute: i32,
}

/// Error response for authentication failures.
#[derive(Serialize)]
pub struct AuthError {
    pub message: String,
}

impl<B> FromRequestParts<B> for AuthenticatedApiKey
where
    B: Send + Sync,
{
    type Rejection = (StatusCode, Json<AuthError>);

    async fn from_request_parts(parts: &mut Parts, _state: &B) -> Result<Self, Self::Rejection> {
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

        let mut conn = db.get().await.map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthError {
                    message: "Database error".to_string(),
                }),
            )
        })?;

        let api_key: AuthenticatedApiKey = sqlx::query_as(
            r#"
            SELECT id, tenant_id, key_prefix, scopes, rate_limit_per_minute
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

        let forbidden = |m: &str| (StatusCode::FORBIDDEN, Json(AuthError { message: m.to_string() }));
        if let Some(required) = required_scope(&parts.method, parts.uri.path()) {
            if !scope_allows(&api_key.scopes, &required) {
                return Err(forbidden(&format!("This API key lacks the '{required}' scope.")));
            }
        }
        if !crate::core::limits::within_key_quota(&api_key.id, api_key.rate_limit_per_minute).await
            || !crate::core::limits::within_tenant_quota(&api_key.tenant_id).await
        {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(AuthError { message: "API key rate limit exceeded.".to_string() }),
            ));
        }

        Ok(api_key)
    }
}

/// The scope a request needs, derived from its path and method:
/// `<resource>:read` for GET/HEAD and `<resource>:write` otherwise, where
/// resource is the first path segment after `/v1/`. Tenant administration
/// (minting keys, managing staff) needs `tenant-admin`. `GET /v1/tenants/me`
/// needs nothing beyond a valid key.
pub fn required_scope(method: &axum::http::Method, path: &str) -> Option<String> {
    let seg: Vec<&str> = path.trim_matches('/').split('/').collect();
    let resource = *seg.get(1)?;
    match (resource, seg.get(2).copied()) {
        ("tenants", Some("me")) => None,
        ("tenants", _) | ("tenant-staff", _) => Some("tenant-admin".to_string()),
        _ => {
            let action = if method == axum::http::Method::GET || method == axum::http::Method::HEAD { "read" } else { "write" };
            Some(format!("{resource}:{action}"))
        }
    }
}

/// `*` and `<resource>:*` grant everything they cover, and `<resource>:write`
/// implies `<resource>:read`.
pub fn scope_allows(scopes: &[String], required: &str) -> bool {
    if scopes.iter().any(|s| s == "*" || s == required) {
        return true;
    }
    if let Some((resource, action)) = required.split_once(':') {
        if scopes.iter().any(|s| s == &format!("{resource}:*")) {
            return true;
        }
        if action == "read" && scopes.iter().any(|s| s == &format!("{resource}:write")) {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Method;

    fn v(s: &[&str]) -> Vec<String> { s.iter().map(|x| x.to_string()).collect() }

    #[test]
    fn derives_scope_from_method_and_path() {
        assert_eq!(required_scope(&Method::GET, "/v1/subjects/abc").as_deref(), Some("subjects:read"));
        assert_eq!(required_scope(&Method::POST, "/v1/verification-cases").as_deref(), Some("verification-cases:write"));
        assert_eq!(required_scope(&Method::DELETE, "/v1/tenants/t1/api-keys/k").as_deref(), Some("tenant-admin"));
        assert_eq!(required_scope(&Method::GET, "/v1/tenant-staff").as_deref(), Some("tenant-admin"));
        assert_eq!(required_scope(&Method::GET, "/v1/tenants/me"), None);
    }

    #[test]
    fn write_implies_read_but_not_the_reverse() {
        assert!(scope_allows(&v(&["subjects:write"]), "subjects:read"));
        assert!(!scope_allows(&v(&["subjects:read"]), "subjects:write"));
        assert!(!scope_allows(&v(&["subjects:read"]), "tenant-admin"));
        assert!(!scope_allows(&v(&["subjects:write"]), "organizations:read"));
    }

    #[test]
    fn wildcards() {
        assert!(scope_allows(&v(&["*"]), "tenant-admin"));
        assert!(scope_allows(&v(&["organizations:*"]), "organizations:write"));
        assert!(!scope_allows(&v(&["organizations:*"]), "subjects:read"));
    }

}
