//! Authentication guards — replace NestJS guards from TypeScript.
//!
//! Mirrors `apps/api/src/core/auth/` with Axum extractors and middleware.

pub mod session;
pub mod api_key;
pub mod types;
pub mod platform_admin;
pub mod tenant_actor;

