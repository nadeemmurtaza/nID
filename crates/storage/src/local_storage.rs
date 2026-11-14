//! Local-disk storage driver for development and single-host deployments.
//!
//! Mirrors `packages/storage/src/local-storage.driver.ts`.

use std::path::PathBuf;

use tokio::fs;
use tracing::info;

use crate::types::{PutDocumentInput, StorageDriver, StorageError, StoredDocument};

#[async_trait::async_trait]
impl StorageDriver for LocalStorageDriver {
    fn name(&self) -> &str {
        "local"
    }

    async fn put(&self, input: PutDocumentInput) -> Result<StoredDocument, StorageError> {
        let ext = mime_to_extension(&input.content_type);
        let key = uuid::Uuid::new_v4().to_string();
        let dir = self.root.join(&input.namespace).join(&input.group_id);
        fs::create_dir_all(&dir).await?;

        let filename = format!("{key}{ext}");
        let path = dir.join(&filename);
        fs::write(&path, &input.body).await?;

        info!(
            key = %key,
            size = input.body.len(),
            "Stored document to local disk"
        );

        Ok(StoredDocument {
            key,
            size: input.body.len() as u64,
            content_type: input.content_type,
        })
    }

    async fn get(&self, key: &str) -> Result<Vec<u8>, StorageError> {
        // Search for the key across all namespaces
        if let Ok(entries) = fs::read_dir(&self.root).await {
            use futures::StreamExt;
            let stream = entries;
            let mut stream = stream.filter_map(|entry| async {
                let entry = entry.ok()?;
                let namespace = entry.file_name();
                let group_dir = self.root.join(&namespace);
                let sub = fs::read_dir(&group_dir).ok()?;
                futures::stream::TryStreamExt::map(sub, |sub_entry| {
                    let group = sub_entry.file_name();
                    Ok((group_dir.clone(), group))
                })
            });

            // Flatten and search
            let mut found = false;
            let mut entries = Box::pin(fs::read_dir(&self.root));
            while let Some(entry) = entries.next().await {
                let entry = entry?;
                let namespace = entry.file_name();
                let group_dir = self.root.join(&namespace);
                let mut sub_entries = Box::pin(fs::read_dir(&group_dir).await?);
                while let Some(sub_entry) = sub_entries.next().await {
                    let sub_entry = sub_entry?;
                    let group = sub_entry.file_name();
                    let file_dir = sub_entry.path();
                    let mut file_entries = Box::pin(fs::read_dir(&file_dir).await?);
                    while let Some(file_entry) = file_entries.next().await {
                        let file_entry = file_entry?;
                        let file_name = file_entry.file_name();
                        if file_name.to_string_lossy().starts_with(key) {
                            let path = file_entry.path();
                            let data = fs::read(&path).await?;
                            return Ok(data);
                        }
                    }
                }
            }

            Err(StorageError::NotFound(key.to_string()))
        } else {
            Err(StorageError::NotFound(format!("root not found: {:?}", self.root)))
        }
    }
}

/// Local-disk storage driver.
///
/// Files are stored under `{root}/{namespace}/{groupId}/{uuid}.{ext}`.
/// This is a dev-only driver — for production, use an S3-compatible backend.
pub struct LocalStorageDriver {
    root: PathBuf,
}

impl LocalStorageDriver {
    /// Create a new local storage driver with the given root directory.
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }
}

fn mime_to_extension(content_type: &str) -> &'static str {
    match content_type {
        "image/jpeg" | "image/jpg" => ".jpg",
        "image/png" => ".png",
        "image/gif" => ".gif",
        "image/webp" => ".webp",
        "application/pdf" => ".pdf",
        "application/octet-stream" | _ => ".bin",
    }
}
