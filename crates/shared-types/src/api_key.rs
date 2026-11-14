//! API key generation and hashing.
//!
//! Mirrors `packages/shared-types/src/api-key.ts`.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::Rng;

use crate::crypto::sha256_hex;

/// A generated API key with plaintext (shown once), prefix (for display), and hash (stored).
#[derive(Debug, Clone, serde::Serialize)]
pub struct GeneratedApiKey {
    /// Full plaintext key — shown once, never stored.
    pub plaintext: String,
    /// Non-secret prefix stored alongside the hash for dashboard identification.
    pub prefix: String,
    /// SHA-256 hash of the plaintext key — what actually gets stored.
    pub hash: String,
}

const KEY_BYTE_LENGTH: usize = 24;
const PREFIX_VISIBLE_CHARS: usize = 8;

/// Generate an API key with the given environment prefix (`live` or `test`).
pub fn generate_api_key(env: &str) -> GeneratedApiKey {
    let env = match env {
        "test" => "test",
        _ => "live",
    };
    let mut rng = rand::thread_rng();
    let mut bytes = vec![0u8; KEY_BYTE_LENGTH];
    rng.fill(&mut bytes);
    let raw = URL_SAFE_NO_PAD.encode(&bytes);
    let plaintext = format!("nid_{env}_{raw}");
    let prefix_len = format!("nid_{env}_").len() + PREFIX_VISIBLE_CHARS;
    let prefix = plaintext[..prefix_len.min(plaintext.len())].to_string();
    let hash = sha256_hex(&plaintext);
    GeneratedApiKey {
        plaintext,
        prefix,
        hash,
    }
}

/// Hash a plaintext API key for storage or lookup.
pub fn hash_api_key(plaintext: &str) -> String {
    sha256_hex(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_key_has_correct_prefix() {
        let key = generate_api_key("live");
        assert!(key.plaintext.starts_with("nid_live_"));
        assert!(key.prefix.starts_with("nid_live_"));
    }

    #[test]
    fn hash_matches_plaintext() {
        let key = generate_api_key("test");
        assert_eq!(key.hash, sha256_hex(&key.plaintext));
    }

    #[test]
    fn keys_are_unique() {
        let a = generate_api_key("live");
        let b = generate_api_key("live");
        assert_ne!(a.plaintext, b.plaintext);
    }
}
