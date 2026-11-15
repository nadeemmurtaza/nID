//! Permissions service -- gRPC client for `svc-permissions`.
//!
//! The business logic moved to `crates/permissions`, served by
//! `services/permissions` (see CONVENTIONS.md's crates/services split;
//! this is nID's pilot module). This client keeps the same public shape
//! (`PermissionsService::new`, `get_catalog`/`get_all_permissions`/
//! `get_group_permissions`) so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::permissions::v1::{
    permissions_service_client::PermissionsServiceClient, Empty, GroupRequest, PermissionCatalogEntry as ProtoEntry,
    PermissionGroup as ProtoGroup,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::permissions::dto::{PermissionCatalogEntry, PermissionGroup};

pub struct PermissionsService {
    #[allow(dead_code)]
    db: DbPool,
    #[allow(dead_code)]
    env: AppEnv,
}

fn entry_from_proto(e: ProtoEntry) -> PermissionCatalogEntry {
    PermissionCatalogEntry {
        id: e.id,
        group_name: e.group_name,
        service_name: e.service_name,
        permission_key: e.permission_key,
        label: e.label,
        description: e.description,
    }
}

fn group_from_proto(g: ProtoGroup) -> PermissionGroup {
    PermissionGroup {
        group_name: g.group_name,
        permissions: g.permissions.into_iter().map(entry_from_proto).collect(),
    }
}

async fn client() -> Result<PermissionsServiceClient<tonic::transport::Channel>> {
    let url = std::env::var("PERMISSIONS_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:50071".to_string());
    PermissionsServiceClient::connect(url)
        .await
        .map_err(|e| anyhow!("permissions service unreachable: {e}"))
}

impl PermissionsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn get_catalog(&self) -> Result<Vec<PermissionGroup>> {
        let mut c = client().await?;
        let resp = c.get_catalog(Empty {}).await?.into_inner();
        Ok(resp.groups.into_iter().map(group_from_proto).collect())
    }

    pub async fn get_all_permissions(&self) -> Result<Vec<PermissionCatalogEntry>> {
        let mut c = client().await?;
        let resp = c.get_all(Empty {}).await?.into_inner();
        Ok(resp.entries.into_iter().map(entry_from_proto).collect())
    }

    pub async fn get_group_permissions(&self, group_name: &str) -> Result<Vec<PermissionCatalogEntry>> {
        let mut c = client().await?;
        let resp = c.get_group(GroupRequest { group_name: group_name.to_string() }).await?.into_inner();
        Ok(resp.entries.into_iter().map(entry_from_proto).collect())
    }
}
