//! Permissions service — reads the permission catalog.

use anyhow::Result;
use sqlx::{FromRow, Row};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::permissions::dto::{PermissionCatalogEntry, PermissionGroup};

#[derive(Debug, Clone, FromRow)]
pub struct PermissionRow {
    pub id: String,
    pub group_name: String,
    pub service_name: String,
    pub permission_key: String,
    pub label: String,
    pub description: Option<String>,
}

pub struct PermissionsService {
    db: DbPool,
    env: AppEnv,
}

impl PermissionsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
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
        let mut conn = self.db.get().await?;

        let rows: Vec<PermissionRow> = sqlx::query_as(
            "SELECT id, group_name, service_name, permission_key, label, description FROM permission_catalog ORDER BY group_name, service_name, permission_key",
        )
        .fetch_all(&mut *conn)
        .await?;

        let mut groups: std::collections::HashMap<String, PermissionGroup> = std::collections::HashMap::new();
        for row in rows {
            let group_name = row.group_name.clone();
            groups
                .entry(group_name.clone())
                .or_insert_with(|| PermissionGroup {
                    group_name,
                    permissions: Vec::new(),
                })
                .permissions
                .push(Self::row_to_entry(row));
        }

        let mut result: Vec<PermissionGroup> = groups.into_values().collect();
        result.sort_by(|a, b| a.group_name.cmp(&b.group_name));
        Ok(result)
    }

    pub async fn get_all_permissions(&self) -> Result<Vec<PermissionCatalogEntry>> {
        let mut conn = self.db.get().await?;

        let rows: Vec<PermissionRow> = sqlx::query_as(
            "SELECT id, group_name, service_name, permission_key, label, description FROM permission_catalog ORDER BY group_name, service_name, permission_key",
        )
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(Self::row_to_entry).collect())
    }

    pub async fn get_group_permissions(&self, group_name: &str) -> Result<Vec<PermissionCatalogEntry>> {
        let mut conn = self.db.get().await?;

        let rows: Vec<PermissionRow> = sqlx::query_as(
            "SELECT id, group_name, service_name, permission_key, label, description FROM permission_catalog WHERE group_name = $1 ORDER BY service_name, permission_key",
        )
        .bind(group_name)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(Self::row_to_entry).collect())
    }
}
