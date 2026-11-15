//! Tenant staff service -- gRPC client for `svc-tenant-staff`.
//!
//! Business logic moved to `crates/tenant-staff`, served by
//! `services/tenant-staff` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::tenant_staff::v1::{tenant_staff_service_client::TenantStaffServiceClient, InviteRequest, ListRequest};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::tenant_staff::dto::{InviteStaffRequest, StaffMemberResponse};

pub struct TenantStaffService {
    #[allow(dead_code)]
    db: DbPool,
    #[allow(dead_code)]
    env: AppEnv,
}

fn from_proto(s: newax_proto::tenant_staff::v1::StaffMember) -> StaffMemberResponse {
    StaffMemberResponse {
        id: s.id,
        tenant_id: s.tenant_id,
        account_id: s.account_id,
        role: s.role,
        phone: s.phone,
        phone_verified: s.phone_verified,
        created_at: s.created_at,
    }
}

async fn client() -> Result<TenantStaffServiceClient<tonic::transport::Channel>> {
    let url = std::env::var("TENANT_STAFF_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:50072".to_string());
    TenantStaffServiceClient::connect(url).await.map_err(|e| anyhow!("tenant-staff service unreachable: {e}"))
}

impl TenantStaffService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn invite(
        &self,
        tenant_id: &str,
        _api_key_id: &str,
        req: &InviteStaffRequest,
    ) -> Result<StaffMemberResponse> {
        let mut c = client().await?;
        let resp = c
            .invite(InviteRequest {
                tenant_id: tenant_id.to_string(),
                api_key_id: _api_key_id.to_string(),
                account_id: req.account_id.clone(),
                role: req.role.clone(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(from_proto(resp.into_inner()))
    }

    pub async fn list(&self, tenant_id: &str, _api_key_id: &str) -> Result<Vec<StaffMemberResponse>> {
        let mut c = client().await?;
        let resp = c
            .list(ListRequest { tenant_id: tenant_id.to_string(), api_key_id: _api_key_id.to_string() })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().members.into_iter().map(from_proto).collect())
    }
}
