//! Shared file upload utilities for multipart form handling.
//!
//! Provides functions for reading multipart form fields into memory buffers
//! that can be passed to the storage driver. Mirrors the NestJS FileInterceptor
//! pattern used in TypeScript controllers.

use anyhow::{anyhow, Context, Result};
use axum::extract::Multipart;
use futures::StreamExt;

/// Maximum file size for single uploads (10 MB).
const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024;

/// A file uploaded via multipart form data.
#[derive(Debug)]
pub struct UploadedFile {
    pub buffer: Vec<u8>,
    pub content_type: String,
    pub filename: String,
}

/// Read a single file field from a multipart form.
///
/// Expects exactly one field named `field_name` containing a file.
/// Returns an error if the field is missing, contains no file, or exceeds
/// the maximum file size.
pub async fn read_single_file(multipart: Multipart, field_name: &str) -> Result<UploadedFile> {
    read_file_with_limit(multipart, field_name, MAX_FILE_SIZE).await
}

/// Read a single file field with a custom size limit.
pub async fn read_file_with_limit(
    mut multipart: Multipart,
    field_name: &str,
    max_size: u64,
) -> Result<UploadedFile> {
    let mut found_field: Option<(axum::extract::MultipartData, String, String)> = None;

    while let Some(field) = multipart.next_field().await.context("Failed to read multipart field")? {
        let name = field.name()
            .map(|s| s.to_string())
            .unwrap_or_default();

        if name == field_name {
            if let Some(filename) = field.file_name() {
                let content_type = field.content_type()
                    .map(|m| m.to_string())
                    .unwrap_or_else(|| "application/octet-stream".to_string());

                found_field = Some((field, filename, content_type));
                break;
            }
        }
    }

    let (field, filename, content_type) = found_field
        .ok_or_else(|| anyhow!("No file uploaded — expected multipart field \"{}\"", field_name))?;

    let buffer = read_field_bytes(field, max_size).await?;

    Ok(UploadedFile {
        buffer,
        content_type,
        filename,
    })
}

/// Read multiple file fields (e.g., liveness frames) from a multipart form.
pub async fn read_multiple_files(
    mut multipart: Multipart,
    field_name: &str,
    max_total_size: u64,
) -> Result<Vec<UploadedFile>> {
    let mut files = Vec::new();
    let mut total_size: u64 = 0;

    while let Some(field) = multipart.next_field().await.context("Failed to read multipart field")? {
        let name = field.name()
            .map(|s| s.to_string())
            .unwrap_or_default();

        if name == field_name {
            if let Some(filename) = field.file_name() {
                let content_type = field.content_type()
                    .map(|m| m.to_string())
                    .unwrap_or_else(|| "application/octet-stream".to_string());

                let buffer = read_field_bytes(field, max_total_size - total_size).await?;
                total_size += buffer.len() as u64;

                files.push(UploadedFile {
                    buffer,
                    content_type,
                    filename,
                });
            }
        }
    }

    if files.is_empty() {
        return Err(anyhow!(
            "No files uploaded — expected multipart field \"{}\" (one or more files)",
            field_name
        ));
    }

    Ok(files)
}

/// Read the bytes from a multipart field, enforcing a size limit.
async fn read_field_bytes(
    mut field: axum::extract::MultipartData,
    max_size: u64,
) -> Result<Vec<u8>> {
    let mut buffer = Vec::new();
    let mut total: u64 = 0;

    while let Some(chunk) = field.next().await {
        let chunk = chunk.context("Failed to read chunk")?;
        let chunk_len = chunk.len() as u64;
        if total + chunk_len > max_size {
            return Err(anyhow!(
                "File too large — maximum size is {} MB",
                max_size / (1024 * 1024)
            ));
        }
        buffer.extend_from_slice(&chunk);
        total += chunk_len;
    }

    if buffer.is_empty() {
        return Err(anyhow!("Uploaded file is empty"));
    }

    Ok(buffer)
}
