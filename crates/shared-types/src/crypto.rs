//! SHA-256 hashing and constant-time comparison.
//!
//! Mirrors `packages/shared-types/src/crypto.ts`.

use sha2::{Digest, Sha256};

/// Compute the hex-encoded SHA-256 digest of a UTF-8 string.
pub fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

/// Constant-time comparison of two hex strings.
///
/// Use for anything derived from a secret — a submitted OTP's hash,
/// a webhook signature — so a mismatch can't be timed to leak the
/// expected value one byte at a time. Mismatched lengths return false
/// immediately (safe: length itself isn't the secret).
pub fn constant_time_equal_hex(a: &str, b: &str) -> bool {
    let buf_a = hex::decode(a).ok()?;
    let buf_b = hex::decode(b).ok()?;
    if buf_a.len() != buf_b.len() {
        return false;
    }
    use std::cmp::Ordering;
    let mut result = 0u8;
    for (x, y) in buf_a.iter().zip(buf_b.iter()) {
        result |= x ^ y;
    }
    result == 0
}
