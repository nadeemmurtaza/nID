//! Access service — gRPC client for `svc-access`.
//!
//! Business logic moved to `crates/access`, served by
//! `services/access` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::access::v1::{
    access_api_service_client::AccessApiServiceClient,
    AccessGrantResponse as ProtoAccessGrantResponse,
    AddPartnerRequest, CreateGrantRequest as ProtoCreateGrantRequest,
    Empty, GetGrantRequest, GetMyPermissionsRequest,
    ListGrantsRequest, MyPermissionsResponse as ProtoMyPermissionsResponse,
    PermissionEntry as ProtoPermissionEntry, RevokeGrantRequest,
    TransferOwnershipRequest as ProtoTransferOwnershipRequest,
    UpdateGrantRequest as ProtoUpdateGrantRequest,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::access::dto::{
    AccessGrantResponse, AccessGrantStatus, AccessType, CreateGrantRequest,
    MyPermissionsResponse, PermissionEntry, TransferOwnershipRequest, UpdateGrantRequest,
};

pub struct AccessService {
    #[allow(dead_code)]
    db: DbPool,
    env: AppEnv,
}

fn access_type_str(t: &AccessType) -> &'static str {
    match t {
        AccessType::Owner => "OWNER",
        AccessType::Partner => "PARTNER",
        AccessType::Admin => "ADMIN",
        AccessType::Member => "MEMBER",
    }
}

fn status_str(s: &AccessGrantStatus) -> &'static str {
    match s {
        AccessGrantStatus::Active => "ACTIVE",
        AccessGrantStatus::Revoked => "REVOKED",
        AccessGrantStatus::Pending => "PENDING",
    }
}

fn grant_from_proto(p: ProtoAccessGrantResponse) -> AccessGrantResponse {
    AccessGrantResponse {
        id: p.id,
        account_id: p.account_id,
        tenant_id: p.tenant_id,
        organization_id: p.organization_id,
        brand_id: p.brand_id,
        access_type: p.access_type,
        partnership_percentage: p.partnership_percentage,
        granted_by: p.granted_by,
        status: p.status,
        granted_at: p.granted_at,
        account_phone: p.account_phone,
        account_email: p.account_email,
    }
}

fn permission_from_proto(p: ProtoPermissionEntry) -> PermissionEntry {
    PermissionEntry {
        group_name: p.group_name,
        service_name: p.service_name,
        permission_key: p.permission_key,
        label: p.label,
        granted: p.granted,
    }
}

async fn client() -> Result<AccessApiServiceClient<tonic::transport::Channel>> {
    let url = std::env::var("ACCESS_SERVICE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:50086".to_string());
    AccessApiServiceClient::connect(url)
        .await
        .map_err(|e| anyhow!("access service unreachable: {e}"))
}

impl AccessService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn create_grant(
        &self,
        caller_id: &str,
        tenant_id: &str,
        req: &CreateGrantRequest,
    ) -> Result<AccessGrantResponse> {
        let mut c = client().await?;
        let resp = c
            .create_grant(ProtoCreateGrantRequest {
                caller_id: caller_id.to_string(),
                tenant_id: tenant_id.to_string(),
                account_id: req.account_id.clone(),
                organization_id: req.organization_id.clone(),
                brand_id: req.brand_id.clone(),
                access_type: access_type_str(&req.access_type).to_string(),
                partnership_percentage: req.partnership_percentage,
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(grant_from_proto(resp.into_inner()))
    }

    pub async fn list_grants(
        &self,
        caller_id: &str,
        tenant_id: &str,
        organization_id: Option<&str>,
        brand_id: Option<&str>,
    ) -> Result<Vec<AccessGrantResponse>> {
        let mut c = client().await?;
        let resp = c
            .list_grants(ListGrantsRequest {
                caller_id: caller_id.to_string(),
                tenant_id: tenant_id.to_string(),
                organization_id: organization_id.map(|s| s.to_string()),
                brand_id: brand_id.map(|s| s.to_string()),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp
            .into_inner()
            .grants
            .into_iter()
            .map(grant_from_proto)
            .collect())
    }

    pub async fn get_grant(&self, caller_id: &str, tenant_id: &str, grant_id: &str) -> Result<AccessGrantResponse> {
        let mut c = client().await?;
        let resp = c
            .get_grant(GetGrantRequest {
                caller_id: caller_id.to_string(),
                tenant_id: tenant_id.to_string(),
                grant_id: grant_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(grant_from_proto(resp.into_inner()))
    }

    pub async fn update_grant(
        &self,
        caller_id: &str,
        tenant_id: &str,
        grant_id: &str,
        req: &UpdateGrantRequest,
    ) -> Result<AccessGrantResponse> {
        let mut c = client().await?;
        let resp = c
            .update_grant(ProtoUpdateGrantRequest {
                caller_id: caller_id.to_string(),
                tenant_id: tenant_id.to_string(),
                grant_id: grant_id.to_string(),
                access_type: req.access_type.as_ref().map(|t| access_type_str(t).to_string()),
                partnership_percentage: req.partnership_percentage,
                status: req.status.as_ref().map(|s| status_str(s).to_string()),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(grant_from_proto(resp.into_inner()))
    }

    pub async fn revoke_grant(&self, caller_id: &str, tenant_id: &str, grant_id: &str) -> Result<()> {
        let mut c = client().await?;
        c.revoke_grant(RevokeGrantRequest {
            caller_id: caller_id.to_string(),
            tenant_id: tenant_id.to_string(),
            grant_id: grant_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn transfer_ownership(
        &self,
        caller_id: &str,
        tenant_id: &str,
        req: &TransferOwnershipRequest,
    ) -> Result<AccessGrantResponse> {
        let mut c = client().await?;
        let resp = c
            .transfer_ownership(ProtoTransferOwnershipRequest {
                caller_id: caller_id.to_string(),
                tenant_id: tenant_id.to_string(),
                new_owner_id: req.new_owner_id.clone(),
                organization_id: req.organization_id.clone(),
                brand_id: req.brand_id.clone(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(grant_from_proto(resp.into_inner()))
    }

    pub async fn add_partner(
        &self,
        caller_id: &str,
        tenant_id: &str,
        account_id: &str,
        percentage: f64,
    ) -> Result<AccessGrantResponse> {
        let mut c = client().await?;
        let resp = c
            .add_partner(AddPartnerRequest {
                caller_id: caller_id.to_string(),
                tenant_id: tenant_id.to_string(),
                account_id: account_id.to_string(),
                percentage,
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(grant_from_proto(resp.into_inner()))
    }

    pub async fn get_my_permissions(
        &self,
        account_id: &str,
        tenant_id: &str,
        organization_id: Option<&str>,
        brand_id: Option<&str>,
    ) -> Result<MyPermissionsResponse> {
        let mut c = client().await?;
        let resp = c
            .get_my_permissions(GetMyPermissionsRequest {
                account_id: account_id.to_string(),
                tenant_id: tenant_id.to_string(),
                organization_id: organization_id.map(|s| s.to_string()),
                brand_id: brand_id.map(|s| s.to_string()),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        let p = resp.into_inner();
        Ok(MyPermissionsResponse {
            account_id: p.account_id,
            tenant_id: p.tenant_id,
            permissions: p.permissions.into_iter().map(permission_from_proto).collect(),
        })
    }
}
