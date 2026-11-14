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
