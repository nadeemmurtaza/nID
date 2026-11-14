//! Authentication types shared across guards.

/// Resolved tenant context from an API key.
#[derive(Debug, Clone)]
pub struct AuthenticatedTenant {
    /// The tenant ID.
    pub tenant_id: String,
    /// The API key ID that authenticated this request.
    pub api_key_id: String,
    /// Scopes granted by this API key.
    pub scopes: Vec<String>,
}
