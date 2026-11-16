//! Tenants service — gRPC client for `svc-tenants`.
//!
//! Business logic moved to `crates/tenants`, served by
//! `services/tenants` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::tenants::v1::{
    tenants_api_service_client::TenantsApiServiceClient,
    AccountIdRequest, ApiKeyListResponse, ApiKeyResponse as ProtoApiKeyResponse,
    CreateApiKeyRequest, CreateTenantRequest, CreatedTenantResponse as ProtoCreatedTenantResponse,
    Empty, GetSelfRequest, IdRequest, InviteStaffRequest, NewApiKeyResponse as ProtoNewApiKeyResponse,
    RemoveStaffRequest, RevokeApiKeyRequest, StaffMemberListResponse,
    StaffMemberResponse as ProtoStaffMemberResponse, TenantIdRequest,
    TenantListResponse, TenantMembership as ProtoTenantMembership,
    TenantMembershipListResponse, TenantResponse as ProtoTenantResponse,
    TenantSelfResponse as ProtoTenantSelfResponse,
    TenantWithCountsResponse as ProtoTenantWithCounts, UpdateTenantRequest,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::tenants::dto::{
    ApiKeyResponse, CreatedTenantResponse, NewApiKeyResponse, StaffMemberResponse,
    TenantMembership, TenantResponse, TenantSelfResponse, TenantWithCounts,
};

pub struct TenantsService {
    #[allow(dead_code)]
    db: DbPool,
    env: AppEnv,
}

fn tenant_self_from_proto(p: ProtoTenantSelfResponse) -> TenantSelfResponse {
    let created = p.created_at;
    TenantSelfResponse {
        id: p.id,
        name: p.name,
        slug: p.slug,
        data_residency_region: p.data_residency_region,
        webhook_url: None,
        billing_webhook_url: None,
        created_at: created.clone(),
        updated_at: created,
        signed_in_as: String::new(),
    }
}

fn tenant_from_proto(p: ProtoTenantResponse) -> TenantResponse {
    TenantResponse {
        id: p.id,
        name: p.name,
        slug: p.slug,
        data_residency_region: p.data_residency_region,
        webhook_url: p.webhook_url,
        billing_webhook_url: p.billing_webhook_url,
        created_at: p.created_at,
        updated_at: p.updated_at,
    }
}

fn tenant_counts_from_proto(p: ProtoTenantWithCounts) -> TenantWithCounts {
    TenantWithCounts {
        id: p.id,
        name: p.name,
        slug: p.slug,
        data_residency_region: p.data_residency_region,
        webhook_url: p.webhook_url,
        billing_webhook_url: p.billing_webhook_url,
        created_at: p.created_at,
        updated_at: p.updated_at,
        api_keys_count: p.api_key_count as i64,
        staff_count: p.staff_count as i64,
        subjects_count: 0,
        cases_count: 0,
    }
}

fn created_from_proto(p: ProtoCreatedTenantResponse) -> CreatedTenantResponse {
    CreatedTenantResponse {
        id: p.tenant_id,
        name: p.name,
        slug: p.slug,
        data_residency_region: p.data_residency_region,
        webhook_url: p.webhook_url,
        webhook_secret: p.webhook_secret,
        billing_webhook_url: p.billing_webhook_url,
        billing_webhook_secret: p.billing_webhook_secret,
        api_key: p.api_key,
        created_at: p.created_at,
        message: "Tenant created successfully. Save the API key and webhook secrets — they cannot be recovered.".to_string(),
    }
}

fn membership_from_proto(p: ProtoTenantMembership) -> TenantMembership {
    TenantMembership {
        tenant_id: p.tenant_id,
        tenant_name: p.tenant_name,
        tenant_slug: p.tenant_slug,
        role: p.role,
    }
}

fn api_key_from_proto(p: ProtoApiKeyResponse) -> ApiKeyResponse {
    ApiKeyResponse {
        id: p.id,
        key_prefix: p.name,
        scopes: p.scopes,
        rate_limit_per_minute: p.rate_limit.unwrap_or(60),
        revoked_at: p.revoked_at,
        created_at: p.created_at,
    }
}

fn new_api_key_from_proto(p: ProtoNewApiKeyResponse) -> NewApiKeyResponse {
    NewApiKeyResponse {
        prefix: p.id,
        plaintext: p.key,
        message: "API key created. Save the plaintext key — it cannot be recovered.".to_string(),
    }
}

fn staff_from_proto(p: ProtoStaffMemberResponse) -> StaffMemberResponse {
    StaffMemberResponse {
        id: p.id,
        account_id: p.account_id,
        role: p.role,
        phone: p.phone,
        phone_verified: false,
    }
}

async fn client() -> Result<TenantsApiServiceClient<nid_service_auth::AuthedChannel>> {
    let url = std::env::var("TENANTS_SERVICE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:50089".to_string());
    nid_service_auth::connect(url)
        .await
        .map(TenantsApiServiceClient::new)
        .map_err(|e| anyhow!("tenants service unreachable: {e}"))
}

impl TenantsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn get_self(&self, tenant_id: &str, actor_type: &str) -> Result<TenantSelfResponse> {
        let mut c = client().await?;
        let resp = c
            .get_self(GetSelfRequest {
                tenant_id: tenant_id.to_string(),
                actor_type: actor_type.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(tenant_self_from_proto(resp.into_inner()))
    }

    pub async fn get_memberships_for_account(&self, account_id: &str) -> Result<Vec<TenantMembership>> {
        let mut c = client().await?;
        let resp = c
            .get_memberships_for_account(AccountIdRequest {
                account_id: account_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp
            .into_inner()
            .memberships
            .into_iter()
            .map(membership_from_proto)
            .collect())
    }

    pub async fn create(
        &self,
        name: &str,
        slug: &str,
        data_residency_region: Option<&str>,
        webhook_url: Option<&str>,
        billing_webhook_url: Option<&str>,
        initial_staff_account_id: Option<&str>,
    ) -> Result<CreatedTenantResponse> {
        let mut c = client().await?;
        let resp = c
            .create(CreateTenantRequest {
                name: name.to_string(),
                slug: slug.to_string(),
                data_residency_region: data_residency_region.map(|s| s.to_string()),
                webhook_url: webhook_url.map(|s| s.to_string()),
                billing_webhook_url: billing_webhook_url.map(|s| s.to_string()),
                initial_staff_account_id: initial_staff_account_id.map(|s| s.to_string()),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(created_from_proto(resp.into_inner()))
    }

    pub async fn list_all(&self) -> Result<Vec<TenantWithCounts>> {
        let mut c = client().await?;
        let resp = c
            .list_all(newax_proto::tenants::v1::Empty {})
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp
            .into_inner()
            .tenants
            .into_iter()
            .map(tenant_counts_from_proto)
            .collect())
    }

    pub async fn get_by_id(&self, id: &str) -> Result<TenantWithCounts> {
        let mut c = client().await?;
        let resp = c
            .get_by_id(IdRequest {
                id: id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(tenant_counts_from_proto(resp.into_inner()))
    }

    pub async fn update(
        &self,
        id: &str,
        name: Option<&str>,
        data_residency_region: Option<&str>,
        webhook_url: Option<Option<&str>>,
        billing_webhook_url: Option<Option<&str>>,
    ) -> Result<TenantResponse> {
        let mut c = client().await?;
        let resp = c
            .update(UpdateTenantRequest {
                id: id.to_string(),
                name: name.map(|s| s.to_string()),
                data_residency_region: data_residency_region.map(|s| s.to_string()),
                webhook_url: webhook_url.flatten().map(|s| s.to_string()),
                billing_webhook_url: billing_webhook_url.flatten().map(|s| s.to_string()),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(tenant_from_proto(resp.into_inner()))
    }

    pub async fn create_api_key(
        &self,
        tenant_id: &str,
        scopes: Option<Vec<String>>,
        rate_limit: Option<i32>,
    ) -> Result<NewApiKeyResponse> {
        let mut c = client().await?;
        let resp = c
            .create_api_key(CreateApiKeyRequest {
                tenant_id: tenant_id.to_string(),
                scopes: scopes.unwrap_or_default(),
                rate_limit,
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(new_api_key_from_proto(resp.into_inner()))
    }

    pub async fn list_api_keys(&self, tenant_id: &str) -> Result<Vec<ApiKeyResponse>> {
        let mut c = client().await?;
        let resp = c
            .list_api_keys(TenantIdRequest {
                tenant_id: tenant_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp
            .into_inner()
            .api_keys
            .into_iter()
            .map(api_key_from_proto)
            .collect())
    }

    pub async fn revoke_api_key(&self, tenant_id: &str, api_key_id: &str) -> Result<()> {
        let mut c = client().await?;
        c.revoke_api_key(RevokeApiKeyRequest {
            tenant_id: tenant_id.to_string(),
            api_key_id: api_key_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn invite_staff(
        &self,
        tenant_id: &str,
        account_id: &str,
        role: &str,
    ) -> Result<StaffMemberResponse> {
        let mut c = client().await?;
        let resp = c
            .invite_staff(InviteStaffRequest {
                tenant_id: tenant_id.to_string(),
                account_id: account_id.to_string(),
                role: role.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(staff_from_proto(resp.into_inner()))
    }

    pub async fn list_staff(&self, tenant_id: &str) -> Result<Vec<StaffMemberResponse>> {
        let mut c = client().await?;
        let resp = c
            .list_staff(TenantIdRequest {
                tenant_id: tenant_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp
            .into_inner()
            .staff
            .into_iter()
            .map(staff_from_proto)
            .collect())
    }

    pub async fn remove_staff(&self, tenant_id: &str, account_id: &str) -> Result<()> {
        let mut c = client().await?;
        c.remove_staff(RemoveStaffRequest {
            tenant_id: tenant_id.to_string(),
            account_id: account_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }
}
