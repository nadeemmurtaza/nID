//! Organizations service — gRPC client for `svc-organizations`.
//!
//! Business logic moved to `crates/organizations`, served by
//! `services/organizations` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::organizations::v1::{
    organizations_api_service_client::OrganizationsApiServiceClient,
    AccountIdRequest, ActiveAdminRequest, ActiveMemberRequest,
    BeneficialOwnerResponse as ProtoBeneficialOwnerResponse,
    CreateOrganizationRequest as ProtoCreateOrgRequest, Empty, GetOrganizationRequest,
    InviteMemberRequest, MembershipListResponse,
    MembershipResponse as ProtoMembershipResponse,
    MyMembership as ProtoMyMembership,
    OrganizationListResponse,
    OrganizationResponse as ProtoOrganizationResponse, RespondToInviteRequest, TenantIdRequest,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::organizations::dto::{
    BeneficialOwnerResponse, CreateOrganizationRequest, MembershipResponse, MyMembershipResponse,
    OrganizationResponse,
};

pub struct OrganizationsService {
    #[allow(dead_code)]
    db: DbPool,
    env: AppEnv,
}

fn org_from_proto(p: ProtoOrganizationResponse) -> OrganizationResponse {
    OrganizationResponse {
        id: p.id,
        tenant_id: p.tenant_id,
        subject_id: p.subject_id,
        legal_name: p.legal_name,
        registration_number: p.registration_number,
        country_code: p.country_code,
        address: p.address,
        created_at: p.created_at,
        updated_at: p.updated_at,
    }
}

fn my_membership_from_proto(p: ProtoMyMembership) -> MyMembershipResponse {
    MyMembershipResponse {
        organization_id: p.organization_id,
        organization_name: p.organization_name,
        tenant_id: p.tenant_id,
        country_code: p.country_code,
        role: p.role,
        is_admin: p.is_admin,
    }
}

fn membership_from_proto(p: ProtoMembershipResponse) -> MembershipResponse {
    MembershipResponse {
        id: p.id,
        tenant_id: p.tenant_id,
        organization_id: p.organization_id,
        subject_id: p.subject_id,
        role: p.role,
        status: p.status,
        phone: p.phone,
        account_id: p.account_id,
        created_at: p.created_at,
    }
}

fn bo_from_proto(p: ProtoBeneficialOwnerResponse) -> BeneficialOwnerResponse {
    BeneficialOwnerResponse {
        id: p.id,
        tenant_id: p.tenant_id,
        organization_id: p.organization_id,
        person_subject_id: p.person_subject_id,
        role: p.role,
        created_at: p.created_at,
    }
}

async fn client() -> Result<OrganizationsApiServiceClient<nid_service_auth::AuthedChannel>> {
    let url = std::env::var("ORGANIZATIONS_SERVICE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:50087".to_string());
    nid_service_auth::connect(url)
        .await
        .map(OrganizationsApiServiceClient::new)
        .map_err(|e| anyhow!("organizations service unreachable: {e}"))
}

impl OrganizationsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn create(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        req: &CreateOrganizationRequest,
    ) -> Result<OrganizationResponse> {
        let mut c = client().await?;
        let resp = c
            .create(ProtoCreateOrgRequest {
                tenant_id: tenant_id.to_string(),
                api_key_id: api_key_id.to_string(),
                subject_id: req.subject_id.clone(),
                legal_name: req.legal_name.clone(),
                registration_number: req.registration_number.clone(),
                country_code: req.country_code.clone(),
                address: req.address.clone(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(org_from_proto(resp.into_inner()))
    }

    pub async fn list_all(&self, tenant_id: &str) -> Result<Vec<OrganizationResponse>> {
        let mut c = client().await?;
        let resp = c
            .list_all(TenantIdRequest {
                tenant_id: tenant_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp
            .into_inner()
            .organizations
            .into_iter()
            .map(org_from_proto)
            .collect())
    }

    pub async fn get_by_id(&self, tenant_id: &str, org_id: &str) -> Result<OrganizationResponse> {
        let mut c = client().await?;
        let resp = c
            .get_by_id(GetOrganizationRequest {
                tenant_id: tenant_id.to_string(),
                org_id: org_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(org_from_proto(resp.into_inner()))
    }

    pub async fn list_memberships(&self, tenant_id: &str, org_id: &str) -> Result<Vec<MembershipResponse>> {
        let mut c = client().await?;
        let resp = c
            .list_memberships(GetOrganizationRequest {
                tenant_id: tenant_id.to_string(),
                org_id: org_id.to_string(),
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

    pub async fn invite_member(
        &self,
        tenant_id: &str,
        org_id: &str,
        phone: &str,
        role: &str,
        api_key_id: &str,
    ) -> Result<MembershipResponse> {
        let mut c = client().await?;
        let resp = c
            .invite_member(InviteMemberRequest {
                tenant_id: tenant_id.to_string(),
                org_id: org_id.to_string(),
                phone: phone.to_string(),
                role: role.to_string(),
                api_key_id: api_key_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(membership_from_proto(resp.into_inner()))
    }

    pub async fn list_beneficial_owners(&self, tenant_id: &str, org_id: &str) -> Result<Vec<BeneficialOwnerResponse>> {
        let mut c = client().await?;
        let resp = c
            .list_beneficial_owners(GetOrganizationRequest {
                tenant_id: tenant_id.to_string(),
                org_id: org_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp
            .into_inner()
            .owners
            .into_iter()
            .map(bo_from_proto)
            .collect())
    }

    pub async fn require_active_admin(&self, organization_id: &str, account_id: &str) -> Result<String> {
        let mut c = client().await?;
        let resp = c
            .require_active_admin(ActiveAdminRequest {
                organization_id: organization_id.to_string(),
                account_id: account_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().tenant_id)
    }

    pub async fn require_active_member(&self, organization_id: &str, account_id: &str) -> Result<()> {
        let mut c = client().await?;
        c.require_active_member(ActiveMemberRequest {
            organization_id: organization_id.to_string(),
            account_id: account_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn list_my_memberships(&self, account_id: &str) -> Result<Vec<MyMembershipResponse>> {
        let mut c = client().await?;
        let resp = c
            .list_my_memberships(AccountIdRequest {
                account_id: account_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp
            .into_inner()
            .memberships
            .into_iter()
            .map(my_membership_from_proto)
            .collect())
    }

    pub async fn list_my_invites(&self, account_id: &str) -> Result<Vec<MembershipResponse>> {
        let mut c = client().await?;
        let resp = c
            .list_my_invites(AccountIdRequest {
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

    pub async fn respond_to_invite(
        &self,
        account_id: &str,
        membership_id: &str,
        response: &str,
    ) -> Result<MembershipResponse> {
        let mut c = client().await?;
        let resp = c
            .respond_to_invite(RespondToInviteRequest {
                account_id: account_id.to_string(),
                membership_id: membership_id.to_string(),
                response: response.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(membership_from_proto(resp.into_inner()))
    }
}
