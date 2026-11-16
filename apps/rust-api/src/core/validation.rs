//! Strict input validation in front of every endpoint.
//!
//! Every request is checked before any handler runs: path segments, query
//! string and JSON body. There is no allow-list of "safe" routes; a field the
//! rules do not know still gets a strict default (bounded length, no control
//! characters, no bidi overrides). Known field names (phone, email, slug, url,
//! country code, ids, coordinates, ...) get type-specific rules on top.
//!
//! The same field rules are mirrored in the browser by
//! `@newax/design-tokens/formGuard`, so a form is stopped before it submits;
//! the server never relies on that, it re-checks everything.

use axum::{
    body::{to_bytes, Body},
    extract::Request,
    http::{header, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::Value;

const MAX_BODY: usize = 1024 * 1024; // 1 MiB of JSON
const MAX_DEPTH: usize = 8;
const MAX_NODES: usize = 5000;
const MAX_ARRAY: usize = 500;
const MAX_QUERY_PAIRS: usize = 40;

static RE_PHONE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^\+[1-9][0-9]{6,14}$").unwrap());
static RE_EMAIL: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$").unwrap());
static RE_SLUG: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$").unwrap());
static RE_USERNAME: Lazy<Regex> = Lazy::new(|| Regex::new(r"^@?[A-Za-z0-9][A-Za-z0-9._-]{1,63}$").unwrap());
static RE_ID: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[A-Za-z0-9_-]{1,64}$").unwrap());
static RE_CC: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[A-Z]{2}$").unwrap());
static RE_CUR: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[A-Z]{3}$").unwrap());
static RE_COLOR: Lazy<Regex> = Lazy::new(|| Regex::new(r"^#[0-9A-Fa-f]{6}$").unwrap());
static RE_TZ: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[A-Za-z_]+(?:/[A-Za-z0-9_+-]+){0,2}$|^UTC$").unwrap());
static RE_OTP: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[0-9]{4,8}$").unwrap());
static RE_SEGMENT: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[A-Za-z0-9._~:@+-]{1,128}$").unwrap());
static RE_KEY: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[A-Za-z0-9_]{1,64}$").unwrap());
static RE_TOKEN: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[A-Za-z0-9._~+/=:-]{1,512}$").unwrap());
static RE_TAG: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)<\s*/?\s*[a-z!]").unwrap());

#[derive(Default)]
struct Problems(Vec<(String, String)>);
impl Problems {
    fn add(&mut self, path: &str, msg: impl Into<String>) {
        if self.0.len() < 20 {
            self.0.push((path.to_string(), msg.into()));
        }
    }
}

fn snake(key: &str) -> String {
    let mut out = String::with_capacity(key.len() + 4);
    for (i, c) in key.chars().enumerate() {
        if c.is_ascii_uppercase() {
            if i > 0 {
                out.push('_');
            }
            out.push(c.to_ascii_lowercase());
        } else {
            out.push(c);
        }
    }
    out
}

/// Bidi overrides and zero-width characters are used to spoof text, so they
/// are refused everywhere. Control characters are refused too, except
/// newline, carriage return and tab in long-text fields.
fn bad_chars(s: &str, allow_newlines: bool) -> bool {
    s.chars().any(|c| {
        matches!(c, '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}' | '\u{200B}'..='\u{200F}' | '\u{FEFF}' | '\u{2028}' | '\u{2029}')
            || (c.is_control() && !(allow_newlines && matches!(c, '\n' | '\r' | '\t')))
    })
}

fn is_long_text(k: &str) -> bool {
    matches!(k, "bio" | "description" | "message" | "notes" | "reason" | "webhook_message" | "tone_guidelines" | "about" | "body" | "content" | "reported_value" | "decision_reason")
}

fn is_short_text(k: &str) -> bool {
    matches!(k, "name" | "display_name" | "legal_name" | "given_name" | "family_name" | "real_name" | "headline" | "title" | "label" | "city" | "region" | "category" | "address" | "address_line1" | "address_line2" | "visitor_name" | "sender_name" | "service_name" | "group_name" | "icon" | "tenant_name" | "brand_name" | "organization_name" | "policy_name" | "subject" | "registration_number" | "national_id_number" | "platform" | "provider_key" | "external_ref" | "reference_id" | "permission_key" | "key_prefix" | "prefix")
}

fn private_host(host: &str) -> bool {
    let h = host.trim_matches(|c| c == '[' || c == ']').to_ascii_lowercase();
    if h == "localhost" || h.ends_with(".localhost") || h.ends_with(".local") || h.ends_with(".internal") || h.ends_with(".lan") {
        return true;
    }
    if let Ok(ip) = h.parse::<std::net::IpAddr>() {
        return match ip {
            std::net::IpAddr::V4(v) => v.is_private() || v.is_loopback() || v.is_link_local() || v.is_unspecified() || v.is_broadcast() || v.octets()[0] == 0 || (v.octets()[0] == 100 && (64..128).contains(&v.octets()[1])),
            std::net::IpAddr::V6(v) => v.is_loopback() || v.is_unspecified() || (v.segments()[0] & 0xfe00) == 0xfc00 || (v.segments()[0] & 0xffc0) == 0xfe80,
        };
    }
    false
}

fn check_url(path: &str, s: &str, k: &str, p: &mut Problems) {
    if s.len() > 2048 {
        return p.add(path, "must be at most 2048 characters");
    }
    let Ok(u) = url::Url::parse(s) else { return p.add(path, "must be a full web address such as https://example.com/path") };
    if !matches!(u.scheme(), "https" | "http") {
        return p.add(path, "must start with https://");
    }
    if !u.username().is_empty() || u.password().is_some() {
        return p.add(path, "must not contain a username or password");
    }
    let Some(host) = u.host_str() else { return p.add(path, "must include a host name") };
    // Addresses the server itself will call (webhooks) must be public https in
    // production; in development http://localhost is fine.
    if matches!(k, "webhook_url" | "billing_webhook_url") && crate::core::limits::is_production() {
        if u.scheme() != "https" {
            return p.add(path, "must be a public https address");
        }
        if private_host(host) {
            p.add(path, "must not point at a private or local address");
        }
    }
}

fn check_string(path: &str, key: &str, s: &str, otp: bool, p: &mut Problems) {
    let k = snake(key);
    let long = is_long_text(&k);
    if bad_chars(s, long) {
        return p.add(path, "contains characters that are not allowed (control, zero-width or direction-override characters)");
    }
    match k.as_str() {
        "phone" | "whatsapp" | "visitor_phone" | "sender_phone" | "account_phone" => {
            let stripped: String = s.chars().filter(|c| !matches!(c, ' ' | '-' | '(' | ')' | '.')).collect();
            if !RE_PHONE.is_match(&stripped) {
                p.add(path, "must be an international phone number such as +14155550123");
            }
        }
        "email" | "public_email" | "visitor_email" | "sender_email" | "account_email" => {
            if s.len() > 254 || !RE_EMAIL.is_match(s) {
                p.add(path, "must be a valid email address");
            }
        }
        "slug" | "brand_slug" | "tenant_slug" => {
            if !RE_SLUG.is_match(s) {
                p.add(path, "must be 1 to 64 lowercase letters, numbers or single hyphens");
            }
        }
        "username" | "grantee_slug" => {
            if !RE_USERNAME.is_match(s) {
                p.add(path, "must be 2 to 64 letters, numbers, dots, dashes or underscores");
            }
        }
        "country_code" => {
            if !RE_CC.is_match(s) {
                p.add(path, "must be a two-letter uppercase country code such as US");
            }
        }
        "currency" => {
            if !RE_CUR.is_match(s) {
                p.add(path, "must be a three-letter uppercase currency code such as USD");
            }
        }
        "color" | "primary_color" | "secondary_color" => {
            if !RE_COLOR.is_match(s) {
                p.add(path, "must be a hex colour such as #1a2b3c");
            }
        }
        "timezone" => {
            if s.len() > 64 || !RE_TZ.is_match(s) {
                p.add(path, "must be an IANA time zone such as Europe/London");
            }
        }
        "code" if otp => {
            if !RE_OTP.is_match(s) {
                p.add(path, "must be the 4 to 8 digit code you received");
            }
        }
        // OAuth authorization codes and similar opaque tokens.
        "code" | "state" | "session_token" | "access_token" | "client_secret" | "client_id" | "api_key" => {
            if s.len() > 512 || !RE_TOKEN.is_match(s) {
                p.add(path, "is not a valid token");
            }
        }
        "url" | "website" | "webhook_url" | "billing_webhook_url" | "redirect_uri" | "hosted_url" | "approval_url" => {
            if !s.is_empty() {
                check_url(path, s, &k, p);
            }
        }
        _ if k == "id" || k.ends_with("_id") => {
            if !RE_ID.is_match(s) {
                p.add(path, "must be 1 to 64 letters, numbers, dashes or underscores");
            }
        }
        _ if is_short_text(&k) => {
            if s.chars().count() > 200 {
                p.add(path, "must be at most 200 characters");
            } else if RE_TAG.is_match(s) {
                p.add(path, "must not contain HTML tags");
            }
        }
        _ if long => {
            if s.chars().count() > 5000 {
                p.add(path, "must be at most 5000 characters");
            }
        }
        _ => {
            if s.chars().count() > 2048 {
                p.add(path, "must be at most 2048 characters");
            }
        }
    }
}

fn check_number(path: &str, key: &str, n: &serde_json::Number, p: &mut Problems) {
    let Some(f) = n.as_f64() else { return p.add(path, "must be a finite number") };
    if !f.is_finite() || f.abs() > 1.0e12 {
        return p.add(path, "is out of range");
    }
    let k = snake(key);
    let range = match k.as_str() {
        "latitude" => Some((-90.0, 90.0)),
        "longitude" => Some((-180.0, 180.0)),
        "percentage" | "partnership_percentage" => Some((0.0, 100.0)),
        "rate_limit_per_minute" => Some((1.0, 10000.0)),
        "start_minute" | "end_minute" | "open_minute" | "close_minute" => Some((0.0, 1440.0)),
        "duration_minutes" => Some((1.0, 1440.0)),
        "day" => Some((0.0, 6.0)),
        "price" => Some((0.0, 1.0e9)),
        _ => None,
    };
    if let Some((lo, hi)) = range {
        if f < lo || f > hi {
            p.add(path, format!("must be between {lo} and {hi}"));
        }
    }
}

fn walk(v: &Value, path: &str, key: &str, depth: usize, nodes: &mut usize, otp: bool, p: &mut Problems) {
    *nodes += 1;
    if *nodes > MAX_NODES {
        return p.add(path, "the request is too large");
    }
    if depth > MAX_DEPTH {
        return p.add(path, "is nested too deeply");
    }
    match v {
        Value::String(s) => check_string(path, key, s, otp, p),
        Value::Number(n) => check_number(path, key, n, p),
        Value::Array(a) => {
            if a.len() > MAX_ARRAY {
                return p.add(path, format!("must have at most {MAX_ARRAY} items"));
            }
            for (i, item) in a.iter().enumerate() {
                walk(item, &format!("{path}[{i}]"), key, depth + 1, nodes, otp, p);
            }
        }
        Value::Object(m) => {
            if m.len() > 100 {
                return p.add(path, "has too many fields");
            }
            for (k, val) in m {
                if !RE_KEY.is_match(k) {
                    p.add(path, format!("has a field name that is not allowed: {}", k.chars().take(24).collect::<String>()));
                    continue;
                }
                let child = if path.is_empty() { k.clone() } else { format!("{path}.{k}") };
                walk(val, &child, k, depth + 1, nodes, otp, p);
            }
        }
        Value::Bool(_) | Value::Null => {}
    }
}

fn reject(status: StatusCode, p: Problems) -> Response {
    let fields: Vec<Value> = p.0.iter().map(|(f, m)| serde_json::json!({ "field": f, "message": m })).collect();
    let message = p.0.first().map(|(f, m)| if f.is_empty() { m.clone() } else { format!("{f} {m}") }).unwrap_or_else(|| "Invalid request".into());
    (status, Json(serde_json::json!({ "error": "Validation Error", "message": message, "fields": fields }))).into_response()
}

fn query_problems(q: &str, otp: bool, p: &mut Problems) {
    let pairs: Vec<(String, String)> = url::form_urlencoded::parse(q.as_bytes()).map(|(k, v)| (k.into_owned(), v.into_owned())).collect();
    if pairs.len() > MAX_QUERY_PAIRS {
        return p.add("query", "has too many parameters");
    }
    for (k, v) in pairs {
        if !RE_KEY.is_match(&k) {
            p.add("query", "has a parameter name that is not allowed");
            continue;
        }
        check_string(&format!("query.{k}"), &k, &v, otp, p);
    }
}

pub async fn gate(req: Request, next: Next) -> Response {
    let (parts, body) = req.into_parts();
    let mut p = Problems::default();
    let otp = parts.uri.path().starts_with("/v1/accounts/");

    if parts.uri.path().len() > 512 {
        p.add("path", "is too long");
    }
    for seg in parts.uri.path().split('/').filter(|s| !s.is_empty()) {
        let decoded = urlencoding::decode(seg).map(|c| c.into_owned()).unwrap_or_default();
        if decoded.is_empty() || decoded == "." || decoded == ".." || !RE_SEGMENT.is_match(&decoded) {
            p.add("path", "contains a segment that is not allowed");
            break;
        }
    }
    if let Some(q) = parts.uri.query() {
        if q.len() > 4096 {
            p.add("query", "is too long");
        } else {
            query_problems(q, otp, &mut p);
        }
    }
    if !p.0.is_empty() {
        return reject(StatusCode::BAD_REQUEST, p);
    }

    let has_body = !matches!(parts.method, Method::GET | Method::HEAD | Method::OPTIONS);
    let ctype = parts.headers.get(header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).unwrap_or("").to_ascii_lowercase();
    let declared: usize = parts.headers.get(header::CONTENT_LENGTH).and_then(|v| v.to_str().ok()).and_then(|v| v.parse().ok()).unwrap_or(0);

    let body = if has_body && ctype.starts_with("application/json") {
        let bytes = match to_bytes(body, MAX_BODY).await {
            Ok(b) => b,
            Err(_) => {
                let mut p = Problems::default();
                p.add("body", "is larger than the 1 MiB limit");
                return reject(StatusCode::PAYLOAD_TOO_LARGE, p);
            }
        };
        if !bytes.is_empty() {
            match serde_json::from_slice::<Value>(&bytes) {
                Ok(v) => {
                    let mut nodes = 0;
                    walk(&v, "", "", 0, &mut nodes, otp, &mut p);
                    if !p.0.is_empty() {
                        return reject(StatusCode::UNPROCESSABLE_ENTITY, p);
                    }
                }
                Err(_) => {
                    let mut p = Problems::default();
                    p.add("body", "is not valid JSON");
                    return reject(StatusCode::BAD_REQUEST, p);
                }
            }
        }
        Body::from(bytes)
    } else if has_body && declared > 0 && !(ctype.starts_with("multipart/form-data") || ctype.starts_with("application/x-www-form-urlencoded")) {
        let mut p = Problems::default();
        p.add("body", "must be sent as application/json");
        return reject(StatusCode::UNSUPPORTED_MEDIA_TYPE, p);
    } else {
        body
    };
    next.run(Request::from_parts(parts, body)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    fn run(v: Value) -> Vec<(String, String)> {
        let mut p = Problems::default();
        let mut n = 0;
        walk(&v, "", "", 0, &mut n, true, &mut p);
        p.0
    }
    #[test]
    fn accepts_good_input() {
        assert!(run(serde_json::json!({"phone":"+14155550123","email":"a@b.co","slug":"acme-pay","countryCode":"US","website":"https://example.com/x","latitude":51.5})).is_empty());
    }
    #[test]
    fn rejects_bad_input() {
        for (v, why) in [
            (serde_json::json!({"phone":"4155550123"}), "no plus"),
            (serde_json::json!({"email":"not-an-email"}), "email"),
            (serde_json::json!({"slug":"Bad Slug"}), "slug"),
            (serde_json::json!({"countryCode":"usa"}), "cc"),
            (serde_json::json!({"name":"<script>alert(1)</script>"}), "tag"),
            (serde_json::json!({"name":"a\u{202E}b"}), "bidi"),
            (serde_json::json!({"name":"a\u{0000}b"}), "nul"),
            (serde_json::json!({"website":"javascript:alert(1)"}), "scheme"),
            (serde_json::json!({"website":"https://u:p@example.com"}), "creds"),
            (serde_json::json!({"latitude":91}), "lat"),
            (serde_json::json!({"accountId":"../../etc"}), "id"),
            (serde_json::json!({"bad key":1}), "key"),
            (serde_json::json!({"code":"12ab"}), "otp"),
        ] {
            assert!(!run(v).is_empty(), "should reject: {why}");
        }
    }
    #[test]
    fn depth_and_size_limits() {
        let mut v = serde_json::json!(1);
        for _ in 0..12 { v = serde_json::json!({ "a": v }); }
        assert!(!run(v).is_empty());
        assert!(!run(serde_json::json!({"items": vec![1; 600]})).is_empty());
    }
}
