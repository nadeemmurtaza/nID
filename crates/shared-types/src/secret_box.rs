//! Encryption at rest for secrets that must be recoverable (SECURITY_RULES.md).
//!
//! Tenant webhook secrets are used to sign outbound webhooks, so they cannot
//! be hashed the way API keys are: signing needs the real value. They are
//! stored AES-256-GCM encrypted instead, with the key held outside the
//! database (`WEBHOOK_SECRET_KEY`), so a database dump alone does not reveal
//! them.
//!
//! Stored format: `v1.<nonce>.<ciphertext+tag>`, both base64url without
//! padding. Each value is bound to a context string (tenant and field) as
//! associated data, so a ciphertext copied to another tenant or column fails
//! to decrypt. `apps/api/src/core/crypto/secret-box.ts` reads and writes the
//! same format.
//!
//! Rotation: set `WEBHOOK_SECRET_KEY` to the new key and
//! `WEBHOOK_SECRET_KEY_PREVIOUS` to the old one; values decrypt with either
//! and are written with the new one.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use rand::RngCore;

#[derive(Debug, thiserror::Error)]
pub enum SecretBoxError {
    #[error("WEBHOOK_SECRET_KEY is not set")]
    MissingKey,
    #[error("a secret key must be 32 bytes, base64 encoded")]
    BadKey,
    #[error("stored secret is not in a recognised format")]
    BadFormat,
    #[error("stored secret could not be decrypted (wrong key, or it belongs to a different tenant or field)")]
    Decrypt,
}

pub struct SecretBox {
    current: Aes256Gcm,
    previous: Option<Aes256Gcm>,
}

fn cipher(b64: &str) -> Result<Aes256Gcm, SecretBoxError> {
    let bytes = STANDARD.decode(b64.trim()).map_err(|_| SecretBoxError::BadKey)?;
    Aes256Gcm::new_from_slice(&bytes).map_err(|_| SecretBoxError::BadKey)
}

impl SecretBox {
    pub fn from_env() -> Result<Self, SecretBoxError> {
        let current = std::env::var("WEBHOOK_SECRET_KEY").map_err(|_| SecretBoxError::MissingKey)?;
        let previous = std::env::var("WEBHOOK_SECRET_KEY_PREVIOUS").ok().filter(|v| !v.is_empty());
        Self::new(&current, previous.as_deref())
    }

    pub fn new(current_b64: &str, previous_b64: Option<&str>) -> Result<Self, SecretBoxError> {
        Ok(Self {
            current: cipher(current_b64)?,
            previous: previous_b64.map(cipher).transpose()?,
        })
    }

    /// Encrypt `plaintext`, binding it to `context` (for example
    /// `tenant:<id>:webhook`).
    pub fn encrypt(&self, context: &str, plaintext: &str) -> String {
        let mut nonce = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce);
        let ct = self
            .current
            .encrypt(Nonce::from_slice(&nonce), Payload { msg: plaintext.as_bytes(), aad: context.as_bytes() })
            .expect("AES-GCM encryption does not fail for in-memory input");
        format!("v1.{}.{}", URL_SAFE_NO_PAD.encode(nonce), URL_SAFE_NO_PAD.encode(ct))
    }

    pub fn decrypt(&self, context: &str, stored: &str) -> Result<String, SecretBoxError> {
        let mut parts = stored.split('.');
        let (Some("v1"), Some(n), Some(c), None) = (parts.next(), parts.next(), parts.next(), parts.next()) else {
            return Err(SecretBoxError::BadFormat);
        };
        let nonce = URL_SAFE_NO_PAD.decode(n).map_err(|_| SecretBoxError::BadFormat)?;
        let ct = URL_SAFE_NO_PAD.decode(c).map_err(|_| SecretBoxError::BadFormat)?;
        if nonce.len() != 12 {
            return Err(SecretBoxError::BadFormat);
        }
        let payload = || Payload { msg: &ct, aad: context.as_bytes() };
        let plain = self
            .current
            .decrypt(Nonce::from_slice(&nonce), payload())
            .or_else(|e| match &self.previous {
                Some(p) => p.decrypt(Nonce::from_slice(&nonce), payload()),
                None => Err(e),
            })
            .map_err(|_| SecretBoxError::Decrypt)?;
        String::from_utf8(plain).map_err(|_| SecretBoxError::Decrypt)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(byte: u8) -> String {
        STANDARD.encode([byte; 32])
    }

    #[test]
    fn round_trips() {
        let b = SecretBox::new(&key(1), None).unwrap();
        let stored = b.encrypt("tenant:t1:webhook", "s3cret-value");
        assert!(stored.starts_with("v1."));
        assert!(!stored.contains("s3cret"));
        assert_eq!(b.decrypt("tenant:t1:webhook", &stored).unwrap(), "s3cret-value");
    }

    #[test]
    fn same_value_encrypts_differently_each_time() {
        let b = SecretBox::new(&key(1), None).unwrap();
        assert_ne!(b.encrypt("c", "x"), b.encrypt("c", "x"));
    }

    #[test]
    fn rejects_the_wrong_key_context_and_tampering() {
        let b = SecretBox::new(&key(1), None).unwrap();
        let stored = b.encrypt("tenant:t1:webhook", "v");
        assert!(SecretBox::new(&key(2), None).unwrap().decrypt("tenant:t1:webhook", &stored).is_err());
        assert!(b.decrypt("tenant:t2:webhook", &stored).is_err());
        assert!(b.decrypt("tenant:t1:billing", &stored).is_err());
        let mut bad = stored.clone();
        bad.push('A');
        assert!(b.decrypt("tenant:t1:webhook", &bad).is_err());
        assert!(matches!(b.decrypt("c", "plain-text"), Err(SecretBoxError::BadFormat)));
    }

    #[test]
    fn rotation_reads_old_values_and_writes_new_ones() {
        let old = SecretBox::new(&key(1), None).unwrap();
        let stored = old.encrypt("c", "v");
        let rotated = SecretBox::new(&key(2), Some(&key(1))).unwrap();
        assert_eq!(rotated.decrypt("c", &stored).unwrap(), "v");
        let fresh = rotated.encrypt("c", "v");
        assert!(SecretBox::new(&key(2), None).unwrap().decrypt("c", &fresh).is_ok());
        assert!(old.decrypt("c", &fresh).is_err());
    }

    #[test]
    fn rejects_malformed_keys() {
        assert!(SecretBox::new("not-base64!!", None).is_err());
        assert!(SecretBox::new(&STANDARD.encode([0u8; 16]), None).is_err());
    }
}

#[cfg(test)]
mod interop {
    use super::*;

    /// A value written by apps/api's TypeScript SecretBox (key = 32 x 0x09,
    /// context "tenant:t5:billing") must decrypt here.
    #[test]
    fn reads_a_value_written_by_typescript() {
        let b = SecretBox::new(&STANDARD.encode([9u8; 32]), None).unwrap();
        let from_ts = "v1.flcD-UQ0dLCUTYBG.G9GV9YjQ4jZ59OKQxm4X3WlW3QfFMoLAI9GFuv40Tw";
        assert_eq!(b.decrypt("tenant:t5:billing", from_ts).unwrap(), "from-typescript");
    }

    /// Prints a value for apps/api's TypeScript test to read. Run with
    /// `cargo test -p nid-shared-types interop -- --nocapture --ignored`.
    #[test]
    #[ignore]
    fn print_fixture_for_typescript() {
        let b = SecretBox::new(&STANDARD.encode([7u8; 32]), None).unwrap();
        println!("FIXTURE={}", b.encrypt("tenant:t9:webhook", "from-rust"));
    }
}
