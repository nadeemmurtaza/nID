//! Storage driver types — the contract between callers and backends.
//!
//! Mirrors `packages/storage/src/types.ts`.

use async_trait::async_trait;

/// Input for storing a document upload.
#[derive(Debug)]
pub struct PutDocumentInput {
    /// Top-level namespace (e.g., tenant_id or profile_id).
    pub namespace: String,
    /// Secondary grouping within the namespace (e.g., method_attempt_id).
    pub group_id: String,
    /// Original filename from the upload.
    pub filename: String,
    /// MIME content type of the uploaded bytes.
    pub content_type: String,
    /// Raw file bytes.
    pub body: Vec<u8>,
}

/// Metadata about a stored document.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StoredDocument {
    /// Opaque key to persist on DocumentAsset.storageKey — not a URL.
    pub key: String,
    /// File size in bytes.
    pub size: u64,
    /// MIME content type.
    pub content_type: String,
}

/// Pluggable storage backend.
#[async_trait]
#[async_trait::async_trait]
pub trait StorageDriver: Send + Sync {
    /// Return the driver name (e.g., "local" or "s3").
    fn name(&self) -> &str;

    /// Store uploaded bytes and return metadata.
    async fn put(&self, input: PutDocumentInput) -> Result<StoredDocument, StorageError>;

    /// Retrieve stored bytes by key.
    async fn get(&self, key: &str) -> Result<Vec<u8>, StorageError>;
}

/// Errors from storage operations.
#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Document not found: {0}")]
    NotFound(String),

    #[error("Invalid key format: {0}")]
    InvalidKey(String),
}
