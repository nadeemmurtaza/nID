//! File storage abstraction for nID.
//!
//! Mirrors `packages/storage` from the TypeScript codebase.
//! Provides a driver interface with pluggable backends — currently only
//! local-disk storage for dev/single-host use. An S3-compatible driver
//! is the documented follow-up for production multi-host deployments.

pub mod types;
pub mod local_storage;

pub use types::{PutDocumentInput, StoredDocument, StorageDriver};
pub use local_storage::LocalStorageDriver;

/// Identify an upload from its leading bytes. Client-supplied MIME types and
/// file extensions are attacker-controlled; this is the only trusted signal.
/// Returns None for anything outside the allowlist (JPEG, PNG, WebP, PDF).
pub fn sniff_content_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        Some("image/png")
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else if bytes.starts_with(b"%PDF-") {
        Some("application/pdf")
    } else {
        None
    }
}

#[cfg(test)]
mod sniff_tests {
    use super::sniff_content_type;

    #[test]
    fn recognises_allowed_types() {
        assert_eq!(sniff_content_type(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("image/jpeg"));
        assert_eq!(sniff_content_type(b"\x89PNG\r\n\x1a\n...."), Some("image/png"));
        assert_eq!(sniff_content_type(b"RIFF\0\0\0\0WEBPVP8 "), Some("image/webp"));
        assert_eq!(sniff_content_type(b"%PDF-1.7"), Some("application/pdf"));
    }

    #[test]
    fn rejects_everything_else() {
        assert_eq!(sniff_content_type(b"<?php echo 1; ?>"), None);
        assert_eq!(sniff_content_type(b"<svg onload=alert(1)>"), None);
        assert_eq!(sniff_content_type(b"MZ\x90\x00"), None);
        assert_eq!(sniff_content_type(b""), None);
    }
}
