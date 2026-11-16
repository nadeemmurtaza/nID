//! Tenant-actor authentication — replaces TenantActorGuard from TypeScript.
//!
//! A strict superset of the API-key guard: accepts the same tenant API key,
//! OR a staff Account's session token resolved through TenantStaffMembership
//! to whichever tenant they're staff of. Mirrors
//! `apps/api/src/core/auth/tenant-actor.guard.ts`.

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::Json;
use sqlx::Row;

use crate::core::auth::session::AuthError;
use crate::core::db::DbPool;

/// The resolved caller for routes any tenant staff member or API key can use.
#[derive(Debug, Clone)]
pub struct AuthenticatedActor {
    pub tenant_id: String,
    pub actor_type: &'static str,
    pub actor_id: String,
}

fn err(status: StatusCode, message: &str) -> (StatusCode, Json<AuthError>) {
    (
        status,
        Json(AuthError {
            message: message.to_string(),
        }),
    )
}

impl<B> FromRequestParts<B> for AuthenticatedActor
where
    B: Send + Sync,
{
    type Rejection = (StatusCode, Json<AuthError>);

    async fn from_request_parts(parts: &mut Parts, _state: &B) -> Result<Self, Self::Rejection> {
        let db = parts
            .extensions
            .get::<DbPool>()
            .ok_or_else(|| err(StatusCode::INTERNAL_SERVER_ERROR, "Database not configured"))?
            .clone();

        let header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| err(StatusCode::UNAUTHORIZED, "Missing or malformed Authorization header."))?;

        if !header.starts_with("Bearer ") {
            return Err(err(StatusCode::UNAUTHORIZED, "Missing or malformed Authorization header."));
        }
        let token = header["Bearer ".len()..].trim();
        if token.is_empty() {
            return Err(err(StatusCode::UNAUTHORIZED, "Missing credential."));
        }

        let mut conn = db
            .get()
            .await
            .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

        // Try the tenant API key lookup first — same real hash comparison
        // ApiKeyGuard uses, never a guess about which kind of token this is.
        let key_hash = nid_shared_types::hash_api_key(token);
        let api_key = sqlx::query(
            "SELECT id, tenant_id, scopes, rate_limit_per_minute FROM tenant_api_key WHERE key_hash = $1 AND revoked_at IS NULL",
        )
        .bind(&key_hash)
        .fetch_optional(&mut *conn)
        .await
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

        if let Some(row) = api_key {
            // Same scope and per-key rate limit AuthenticatedApiKey enforces:
            // this path accepts API keys too, so it must not be a way around them.
            let scopes: Vec<String> = row.get("scopes");
            let key_id: String = row.get("id");
            if let Some(required) = crate::core::auth::api_key::required_scope(&parts.method, parts.uri.path()) {
                if !crate::core::auth::api_key::scope_allows(&scopes, &required) {
                    return Err(err(StatusCode::FORBIDDEN, &format!("This API key lacks the '{required}' scope.")));
                }
            }
            if !crate::core::limits::within_key_quota(&key_id, row.get("rate_limit_per_minute")).await
                || !crate::core::limits::within_tenant_quota(&row.get::<String, _>("tenant_id")).await
            {
                return Err(err(StatusCode::TOO_MANY_REQUESTS, "API key rate limit exceeded."));
            }
            return Ok(AuthenticatedActor {
                tenant_id: row.get("tenant_id"),
                actor_type: "API_KEY",
                actor_id: row.get("id"),
            });
        }

        // Fall back to a staff Account session token.
        let token_hash = nid_shared_types::sha256_hex(token);
        let account = sqlx::query(
            r#"
            SELECT a.id FROM account_session s
            JOIN account a ON s.account_id = a.id
            WHERE s.token_hash = $1 AND s.expires_at > NOW()
            "#,
        )
        .bind(&token_hash)
        .fetch_optional(&mut *conn)
        .await
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err(StatusCode::UNAUTHORIZED, "Invalid API key or session token."))?;

        let account_id: String = account.get("id");

        let memberships = sqlx::query("SELECT tenant_id FROM tenant_staff_membership WHERE account_id = $1")
            .bind(&account_id)
            .fetch_all(&mut *conn)
            .await
            .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

        if memberships.is_empty() {
            return Err(err(StatusCode::FORBIDDEN, "This account is not staff on any tenant."));
        }

        let tenant_ids: Vec<String> = memberships.iter().map(|r| r.get("tenant_id")).collect();

        let requested_tenant_id = parts
            .headers
            .get("x-tenant-id")
            .and_then(|v| v.to_str().ok());

        let tenant_id = if let Some(requested) = requested_tenant_id {
            if !tenant_ids.iter().any(|t| t == requested) {
                return Err(err(StatusCode::FORBIDDEN, "This account is not staff on the requested tenant."));
            }
            requested.to_string()
        } else if tenant_ids.len() > 1 {
            return Err(err(StatusCode::BAD_REQUEST, "This account is staff on more than one tenant — send X-Tenant-Id."));
        } else {
            tenant_ids.into_iter().next().unwrap()
        };

        Ok(AuthenticatedActor {
            tenant_id,
            actor_type: "TENANT_STAFF",
            actor_id: account_id,
        })
    }
}
