//! Webhook HMAC signing and verification.
//!
//! Mirrors `packages/shared-types/src/webhook.ts`.

use hmac::{Hmac, Mac};
use sha2::Sha256;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;

type HmacSha256 = Hmac<Sha256>;

/// Sign webhook payload bytes with the given secret, returning a base64-encoded signature.
pub fn sign_webhook(secret: &[u8], payload: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(secret)
        .expect("HMAC can take key of any size");
    mac.update(payload);
    let result = mac.finalize();
    STANDARD.encode(result.into_bytes())
}

/// Verify a base64-encoded HMAC signature against the payload and secret.
pub fn verify_webhook(secret: &[u8], payload: &[u8], signature: &str) -> bool {
    let expected = sign_webhook(secret, payload);
    // Constant-time comparison to prevent timing attacks
    let sig_bytes = STANDARD.decode(signature).unwrap_or_default();
    let exp_bytes = STANDARD.decode(&expected).unwrap_or_default();
    if sig_bytes.len() != exp_bytes.len() {
        return false;
    }
    let mut result = 0u8;
    for (x, y) in sig_bytes.iter().zip(exp_bytes.iter()) {
        result |= x ^ y;
    }
    result == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_and_verify() {
        let secret = b"test-secret";
        let payload = b"test-payload";
        let sig = sign_webhook(secret, payload);
        assert!(verify_webhook(secret, payload, &sig));
    }

    #[test]
    fn wrong_secret_fails() {
        let payload = b"test-payload";
        let sig = sign_webhook(b"secret-a", payload);
        assert!(!verify_webhook(b"secret-b", payload, &sig));
    }

    #[test]
    fn wrong_payload_fails() {
        let secret = b"test-secret";
        let sig = sign_webhook(secret, b"payload-a");
        assert!(!verify_webhook(secret, b"payload-b", &sig));
    }
}
