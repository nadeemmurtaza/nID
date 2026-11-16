//! Roles service -- gRPC client for `svc-roles`.
//!
//! Business logic moved to `crates/roles`, served by
//! `services/roles` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::roles::v1::{
    roles_api_service_client::RolesApiServiceClient,
    AssignRoleRpcRequest, DeleteRoleRequest, Empty, GetAccountRolesRequest,
    GetRoleRequest, ListRolesRequest, RemoveRoleAssignmentRequest,
    RoleAssignmentResponse as ProtoAssignment,
    RoleResponse as ProtoRole,
    CreateRoleRequest as ProtoCreateRole, UpdateRoleRequest as ProtoUpdateRole,
};
use serde_json::Value;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::roles::dto::{
    AssignRoleRequest, RoleAssignmentResponse, RoleResponse,
};

pub struct RolesService {
    #[allow(dead_code)]
    db: DbPool,
    #[allow(dead_code)]
    env: AppEnv,
}

fn role_from_proto(p: ProtoRole) -> RoleResponse {
    let permissions: Value = serde_json::from_str(&p.permissions_json).unwrap_or_default();
    RoleResponse {
        id: p.id,
        tenant_id: p.tenant_id,
        name: p.name,
        slug: p.slug,
        permissions,
        description: p.description,
        is_system: p.is_system,
        created_at: p.created_at,
        updated_at: p.updated_at,
    }
}

fn assignment_from_proto(p: ProtoAssignment) -> RoleAssignmentResponse {
    RoleAssignmentResponse {
        id: p.id,
        account_id: p.account_id,
        role_definition_id: p.role_definition_id,
        tenant_id: p.tenant_id,
        organization_id: p.organization_id,
        brand_id: p.brand_id,
        scope: p.scope,
        created_at: p.created_at,
    }
}

async fn client() -> Result<RolesApiServiceClient<nid_service_auth::AuthedChannel>> {
    let url = std::env::var("ROLES_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:50082".to_string());
    nid_service_auth::connect(url)
        .await
        .map(RolesApiServiceClient::new)
        .map_err(|e| anyhow!("roles service unreachable: {e}"))
}

impl RolesService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn create_role(
        &self,
        account_id: &str,
        tenant_id: &str,
        req: &crate::modules::roles::dto::CreateRoleRequest,
    ) -> Result<RoleResponse> {
        let mut c = client().await?;
        let resp = c.create_role(ProtoCreateRole {
            account_id: account_id.to_string(),
            tenant_id: tenant_id.to_string(),
            name: req.name.clone(),
            slug: req.slug.clone(),
            permissions_json: serde_json::to_string(&req.permissions).unwrap_or_default(),
            description: req.description.clone(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(role_from_proto(resp.into_inner()))
    }

    pub async fn list_roles(&self, account_id: &str, tenant_id: &str) -> Result<Vec<RoleResponse>> {
        let mut c = client().await?;
        let resp = c.list_roles(ListRolesRequest {
            account_id: account_id.to_string(),
            tenant_id: tenant_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().roles.into_iter().map(role_from_proto).collect())
    }

    pub async fn get_role(&self, account_id: &str, tenant_id: &str, role_id: &str) -> Result<RoleResponse> {
        let mut c = client().await?;
        let resp = c.get_role(GetRoleRequest {
            account_id: account_id.to_string(),
            tenant_id: tenant_id.to_string(),
            role_id: role_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(role_from_proto(resp.into_inner()))
    }

    pub async fn update_role(
        &self,
        account_id: &str,
        tenant_id: &str,
        role_id: &str,
        req: &crate::modules::roles::dto::UpdateRoleRequest,
    ) -> Result<RoleResponse> {
        let mut c = client().await?;
        let resp = c.update_role(ProtoUpdateRole {
            account_id: account_id.to_string(),
            tenant_id: tenant_id.to_string(),
            role_id: role_id.to_string(),
            name: req.name.clone(),
            permissions_json: req.permissions.as_ref().and_then(|v| serde_json::to_string(v).ok()),
            description: req.description.as_ref().and_then(|d| d.as_ref()).map(|s| s.to_string()),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(role_from_proto(resp.into_inner()))
    }

    pub async fn delete_role(&self, account_id: &str, tenant_id: &str, role_id: &str) -> Result<()> {
        let mut c = client().await?;
        c.delete_role(DeleteRoleRequest {
            account_id: account_id.to_string(),
            tenant_id: tenant_id.to_string(),
            role_id: role_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn assign_role(
        &self,
        account_id: &str,
        tenant_id: &str,
        role_id: &str,
        req: &AssignRoleRequest,
    ) -> Result<RoleAssignmentResponse> {
        let mut c = client().await?;
        let resp = c.assign_role(AssignRoleRpcRequest {
            account_id: account_id.to_string(),
            tenant_id: tenant_id.to_string(),
            role_id: role_id.to_string(),
            target_account_id: req.account_id.clone(),
            organization_id: req.organization_id.clone(),
            brand_id: req.brand_id.clone(),
            scope: req.scope.clone(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(assignment_from_proto(resp.into_inner()))
    }

    pub async fn remove_role_assignment(
        &self,
        caller_account_id: &str,
        tenant_id: &str,
        role_id: &str,
        account_id: &str,
    ) -> Result<()> {
        let mut c = client().await?;
        c.remove_role_assignment(RemoveRoleAssignmentRequest {
            caller_account_id: caller_account_id.to_string(),
            tenant_id: tenant_id.to_string(),
            role_id: role_id.to_string(),
            account_id: account_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn get_account_roles(&self, caller_account_id: &str, tenant_id: &str, account_id: &str) -> Result<Vec<RoleAssignmentResponse>> {
        let mut c = client().await?;
        let resp = c.get_account_roles(GetAccountRolesRequest {
            caller_account_id: caller_account_id.to_string(),
            tenant_id: tenant_id.to_string(),
            account_id: account_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().assignments.into_iter().map(assignment_from_proto).collect())
    }
}
