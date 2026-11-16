//! Rate limiting at every scope, backed by one shared store (Redis) so all
//! instances enforce the same limits.
//!
//! Scopes, outermost first, each checked independently:
//!   1. global      the whole service, whoever is calling
//!   2. per IP      every client address
//!   3. route class stricter per-IP budgets for sign-in, OTP and OAuth
//!                  (credential guessing), uploads, and any write
//!   4. per phone   OTP start and verify, by number, so rotating IPs does not
//!                  help someone spam or brute-force one account
//!   5. per key     each API key's own quota
//!   6. per tenant  all of a tenant's keys together, so minting more keys
//!                  does not raise the ceiling
//!   7. lockout     repeated 401/403 from one IP bans it for a while
//!
//! If the store is down the limiter falls back to an in-process counter; it
//! never fails open.

use std::{net::SocketAddr, sync::{Arc, OnceLock}, time::Duration};

use axum::{
    body::Body,
    extract::ConnectInfo,
    http::{header, HeaderValue, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use nid_rate_limit::{Decision, RateLimiter};

static LIMITER: OnceLock<Arc<RateLimiter>> = OnceLock::new();

fn envn(name: &str, default: u32) -> u32 {
    std::env::var(name).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}

const MIN: Duration = Duration::from_secs(60);
const HOUR: Duration = Duration::from_secs(3600);

pub fn is_production() -> bool {
    ["APP_ENV", "NODE_ENV", "ENVIRONMENT"].iter().any(|k| std::env::var(k).map(|v| v.eq_ignore_ascii_case("production")).unwrap_or(false))
}

/// Connect the shared limiter. Production refuses to start without Redis:
/// per-instance counters are not a limit once there are two instances.
pub async fn init(production: bool) -> anyhow::Result<()> {
    let url = std::env::var("REDIS_URL").ok().filter(|u| !u.trim().is_empty());
    if production && url.is_none() {
        anyhow::bail!("REDIS_URL must be set in production so rate limits are shared across instances");
    }
    let rl = RateLimiter::connect(url.as_deref(), "nid").await.map_err(|e| anyhow::anyhow!("rate-limit store: {e}"))?;
    tracing::info!(shared = rl.is_shared(), "Rate limiter ready");
    let _ = LIMITER.set(Arc::new(rl));
    Ok(())
}

fn limiter() -> Arc<RateLimiter> {
    // Only reachable before init (tests): an in-process limiter.
    LIMITER
        .get()
        .cloned()
        .unwrap_or_else(|| Arc::new(futures_block(RateLimiter::connect(None, "nid")).expect("local limiter")))
}

fn futures_block<F: std::future::Future>(f: F) -> F::Output {
    tokio::task::block_in_place(|| tokio::runtime::Handle::current().block_on(f))
}

/// The real client address. Forwarding headers are trusted only for the
/// configured number of proxy hops (`TRUSTED_PROXY_HOPS`, default 0), counted
/// from the right of X-Forwarded-For, so a client cannot invent its own
/// address by sending the header itself.
pub fn client_ip(req: &Request<Body>) -> String {
    let hops = envn("TRUSTED_PROXY_HOPS", 0) as usize;
    if hops > 0 {
        if let Some(ip) = req.headers().get("cf-connecting-ip").and_then(|v| v.to_str().ok()) {
            return ip.trim().to_string();
        }
        if let Some(xff) = req.headers().get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
            let parts: Vec<&str> = xff.split(',').map(str::trim).filter(|p| !p.is_empty()).collect();
            if parts.len() >= hops {
                return parts[parts.len() - hops].to_string();
            }
        }
    }
    req.extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|c| c.0.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

fn too_many(d: &Decision, what: &str) -> Response {
    let mut res = (
        StatusCode::TOO_MANY_REQUESTS,
        Json(serde_json::json!({ "error": "Rate Limited", "message": format!("Too many {what}. Try again in {} seconds.", d.retry_after) })),
    )
        .into_response();
    let h = res.headers_mut();
    for (k, v) in [
        ("retry-after", d.retry_after.to_string()),
        ("ratelimit-limit", d.limit.to_string()),
        ("ratelimit-remaining", "0".to_string()),
        ("ratelimit-reset", d.retry_after.to_string()),
    ] {
        if let Ok(v) = HeaderValue::from_str(&v) {
            h.insert(header::HeaderName::from_static(k), v);
        }
    }
    res
}

/// Which strict budget a path falls under: (class name, per-minute, per-hour).
fn route_class(method: &axum::http::Method, path: &str) -> Option<(&'static str, u32, u32)> {
    if path.starts_with("/v1/accounts/otp") || path.starts_with("/v1/accounts/login") || path.starts_with("/v1/accounts/email") || path.starts_with("/v1/oauth") {
        return Some(("auth", envn("RL_AUTH_PER_MIN", 10), envn("RL_AUTH_PER_HOUR", 60)));
    }
    let writes = !matches!(*method, axum::http::Method::GET | axum::http::Method::HEAD | axum::http::Method::OPTIONS);
    if writes && (path.contains("/images") || path.contains("/documents") || path.contains("/upload") || path.contains("/photo")) {
        return Some(("upload", envn("RL_UPLOAD_PER_MIN", 20), envn("RL_UPLOAD_PER_HOUR", 200)));
    }
    if writes {
        return Some(("write", envn("RL_WRITE_PER_MIN", 90), envn("RL_WRITE_PER_HOUR", 2000)));
    }
    None
}

/// The middleware applied in front of every route.
pub async fn guard(req: Request<Body>, next: Next) -> Response {
    let path = req.uri().path().to_string();
    if path == "/health" {
        return next.run(req).await;
    }
    let rl = limiter();
    let ip = client_ip(&req);

    if let Some(secs) = rl.blocked_for("ip", &ip).await {
        let d = Decision { allowed: false, limit: 0, remaining: 0, retry_after: secs };
        return too_many(&d, "failed attempts from this address");
    }
    let d = rl.hit("global", "all", envn("RL_GLOBAL_PER_MIN", 6000), MIN).await;
    if !d.allowed {
        return too_many(&d, "requests to the service");
    }
    let d = rl.hit("ip", &ip, envn("RL_IP_PER_MIN", 240), MIN).await;
    if !d.allowed {
        return too_many(&d, "requests from this address");
    }
    if let Some((class, per_min, per_hour)) = route_class(req.method(), &path) {
        let d = rl.hit(&format!("{class}-min"), &ip, per_min, MIN).await;
        if !d.allowed {
            return too_many(&d, "requests of this kind");
        }
        let d = rl.hit(&format!("{class}-hour"), &ip, per_hour, HOUR).await;
        if !d.allowed {
            return too_many(&d, "requests of this kind");
        }
    }

    let res = next.run(req).await;

    if matches!(res.status(), StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN) {
        let d = rl.hit("authfail", &ip, envn("RL_AUTHFAIL_PER_10MIN", 30), Duration::from_secs(600)).await;
        if !d.allowed {
            rl.block("ip", &ip, Duration::from_secs(envn("RL_LOCKOUT_SECS", 900) as u64)).await;
            tracing::warn!(%ip, "address locked out after repeated authentication failures");
        }
    }
    // Fuzzing and malformed-input probing: a burst of rejected requests also
    // earns a lockout.
    if matches!(res.status(), StatusCode::BAD_REQUEST | StatusCode::PAYLOAD_TOO_LARGE | StatusCode::UNSUPPORTED_MEDIA_TYPE | StatusCode::UNPROCESSABLE_ENTITY) {
        let d = rl.hit("badreq", &ip, envn("RL_BADREQ_PER_10MIN", 60), Duration::from_secs(600)).await;
        if !d.allowed {
            rl.block("ip", &ip, Duration::from_secs(envn("RL_LOCKOUT_SECS", 900) as u64)).await;
            tracing::warn!(%ip, "address locked out after repeated invalid requests");
        }
    }
    res
}

/// One API key's own quota (per minute).
pub async fn within_key_quota(key_id: &str, per_minute: i32) -> bool {
    limiter().hit("key", key_id, per_minute.max(1) as u32, MIN).await.allowed
}

/// All of a tenant's keys together.
pub async fn within_tenant_quota(tenant_id: &str) -> bool {
    limiter().hit("tenant", tenant_id, envn("RL_TENANT_PER_MIN", 3000), MIN).await.allowed
}

/// An authenticated account's own quota across all sessions and IPs.
pub async fn within_account_quota(account_id: &str) -> bool {
    limiter().hit("account", account_id, envn("RL_ACCOUNT_PER_MIN", 600), MIN).await.allowed
}

/// Per-phone budgets for OTP, so changing IP does not reset them.
pub async fn phone_guard(phone: &str, op: &str) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    let (per_10min, per_hour) = if op == "start" {
        (envn("RL_OTP_START_PER_10MIN", 3), envn("RL_OTP_START_PER_HOUR", 6))
    } else {
        (envn("RL_OTP_VERIFY_PER_10MIN", 8), envn("RL_OTP_VERIFY_PER_HOUR", 20))
    };
    let rl = limiter();
    let a = rl.hit(&format!("otp-{op}-10m"), &digits, per_10min, Duration::from_secs(600)).await;
    let b = rl.hit(&format!("otp-{op}-1h"), &digits, per_hour, HOUR).await;
    for d in [a, b] {
        if !d.allowed {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(serde_json::json!({ "error": "Rate Limited", "message": format!("Too many attempts for this number. Try again in {} seconds.", d.retry_after), "retryAfter": d.retry_after })),
            ));
        }
    }
    Ok(())
}
