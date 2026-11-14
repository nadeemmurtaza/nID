//! Session token generation for verification sessions and account sessions.
//!
//! Mirrors `packages/shared-types/src/session-token.ts`.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::Rng;

use crate::crypto::sha256_hex;

/// A generated session token with both plaintext (shown once) and hash (stored).
#[derive(Debug, Clone, serde::Serialize)]
pub struct GeneratedSessionToken {
    /// Full plaintext token — shown once, in the verification-case create response.
    pub plaintext: String,
    /// SHA-256 hash of the plaintext — what's actually stored.
    pub hash: String,
}

/// 192-bit token for verification sessions and account sessions.
const TOKEN_BYTE_LENGTH: usize = 24;

/// Generate a session token (192 bits, base64url-encoded).
pub fn generate_session_token() -> GeneratedSessionToken {
    let mut rng = rand::thread_rng();
    let mut bytes = vec![0u8; TOKEN_BYTE_LENGTH];
    rng.fill(&mut bytes);
    let plaintext = URL_SAFE_NO_PAD.encode(&bytes);
    let hash = sha256_hex(&plaintext);
    GeneratedSessionToken { plaintext, hash }
}

/// 256-bit token for checkout sessions (higher entropy for payment URLs).
const CHECKOUT_TOKEN_BYTE_LENGTH: usize = 32;

/// Generate a checkout token (256 bits, base64url-encoded).
pub fn generate_checkout_token() -> GeneratedSessionToken {
    let mut rng = rand::thread_rng();
    let mut bytes = vec![0u8; CHECKOUT_TOKEN_BYTE_LENGTH];
    rng.fill(&mut bytes);
    let plaintext = URL_SAFE_NO_PAD.encode(&bytes);
    let hash = sha256_hex(&plaintext);
    GeneratedSessionToken { plaintext, hash }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_token_is_unique() {
        let a = generate_session_token();
        let b = generate_session_token();
        assert_ne!(a.plaintext, b.plaintext);
        assert_ne!(a.hash, b.hash);
    }

    #[test]
    fn hash_matches_plaintext() {
        let token = generate_session_token();
        let expected = sha256_hex(&token.plaintext);
        assert_eq!(token.hash, expected);
    }
}
