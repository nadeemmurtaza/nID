//! Permissions catalog — business logic.
//!
//! Extracted from `apps/rust-api/src/modules/permissions/service.rs` as
//! nID's pilot module for CONVENTIONS.md's crates/services split (zero
//! cross-module coupling, which is exactly why it was picked first).
//! Takes a plain `sqlx::PgPool` rather than nID's `core::db::DbPool`
//! wrapper -- this module never needed the tenant-scoped transaction
//! helper that wrapper exists for.

use anyhow::Result;
use serde::Serialize;
use sqlx::{FromRow, PgPool};

#[derive(Debug, Clone, Serialize)]
pub struct PermissionCatalogEntry {
    pub id: String,
    pub group_name: String,
    pub service_name: String,
    pub permission_key: String,
    pub label: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PermissionGroup {
    pub group_name: String,
    pub permissions: Vec<PermissionCatalogEntry>,
}

#[derive(Debug, Clone, FromRow)]
struct PermissionRow {
    id: String,
    group_name: String,
    service_name: String,
    permission_key: String,
    label: String,
    description: Option<String>,
}

pub struct PermissionsService {
    db: PgPool,
}

impl PermissionsService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    fn row_to_entry(row: PermissionRow) -> PermissionCatalogEntry {
        PermissionCatalogEntry {
            id: row.id,
            group_name: row.group_name,
            service_name: row.service_name,
            permission_key: row.permission_key,
            label: row.label,
            description: row.description,
        }
    }

    pub async fn get_catalog(&self) -> Result<Vec<PermissionGroup>> {
        let rows: Vec<PermissionRow> = sqlx::query_as(
            "SELECT id, group_name, service_name, permission_key, label, description FROM permission_catalog ORDER BY group_name, service_name, permission_key",
        )
        .fetch_all(&self.db)
        .await?;

        let mut groups: std::collections::HashMap<String, PermissionGroup> = std::collections::HashMap::new();
        for row in rows {
            let group_name = row.group_name.clone();
            groups
                .entry(group_name.clone())
                .or_insert_with(|| PermissionGroup { group_name, permissions: Vec::new() })
                .permissions
                .push(Self::row_to_entry(row));
        }

        let mut result: Vec<PermissionGroup> = groups.into_values().collect();
        result.sort_by(|a, b| a.group_name.cmp(&b.group_name));
        Ok(result)
    }

    pub async fn get_all_permissions(&self) -> Result<Vec<PermissionCatalogEntry>> {
        let rows: Vec<PermissionRow> = sqlx::query_as(
            "SELECT id, group_name, service_name, permission_key, label, description FROM permission_catalog ORDER BY group_name, service_name, permission_key",
        )
        .fetch_all(&self.db)
        .await?;

        Ok(rows.into_iter().map(Self::row_to_entry).collect())
    }

    pub async fn get_group_permissions(&self, group_name: &str) -> Result<Vec<PermissionCatalogEntry>> {
        let rows: Vec<PermissionRow> = sqlx::query_as(
            "SELECT id, group_name, service_name, permission_key, label, description FROM permission_catalog WHERE group_name = $1 ORDER BY service_name, permission_key",
        )
        .bind(group_name)
        .fetch_all(&self.db)
        .await?;

        Ok(rows.into_iter().map(Self::row_to_entry).collect())
    }
}
