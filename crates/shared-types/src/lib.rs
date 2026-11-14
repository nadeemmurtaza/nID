//! Shared cryptographic and token primitives for nID.
//!
//! Mirrors `packages/shared-types` from the TypeScript codebase.
//! Every function here has a 1:1 counterpart in the TS version so the
//! Rust API can share token formats and hash algorithms with existing
//! clients during the migration period.

pub mod crypto;
pub mod session_token;
pub mod api_key;
pub mod webhook;

pub use crypto::{sha256_hex, constant_time_equal_hex};
pub use session_token::{GeneratedSessionToken, generate_session_token, generate_checkout_token};
pub use api_key::{GeneratedApiKey, generate_api_key, hash_api_key};
pub use webhook::{sign_webhook, verify_webhook};
