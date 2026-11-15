//! Organization Profiles service -- gRPC client for `svc-organization-profiles`.
//!
//! Business logic moved to `crates/organization_profiles`, served by
//! `services/organization_profiles` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::organization_profiles::v1::{
    organization_profiles_api_service_client::OrganizationProfilesApiServiceClient,
    CreateOrgGrantRequest as ProtoCreateGrantReq,
    CreateOrgProfileRequest as ProtoCreateReq,
    OrgIdRequest,
    OrgProfileFieldGrantResponse as ProtoGrantResponse,
    OrgProfileResponse as ProtoProfileResponse,
    RevokeGrantRequest,
    UpdateOrgProfileRequest as ProtoUpdateReq,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::organization_profiles::dto::{
    CreateOrgGrantRequest, CreateOrgProfileRequest, OrgProfileFieldGrantResponse,
    OrgProfileResponse, UpdateOrgProfileRequest,
};

pub struct OrganizationProfilesService {
    #[allow(dead_code)]
    db: DbPool,
    #[allow(dead_code)]
    env: AppEnv,
}

impl OrganizationProfilesService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    fn profile_from_proto(p: ProtoProfileResponse) -> OrgProfileResponse {
        OrgProfileResponse {
            id: p.id,
            organization_id: p.organization_id,
            slug: p.slug,
            display_name: p.display_name,
            headline: p.headline,
            category: p.category,
            bio: p.bio,
            photo_key: p.photo_key,
            phone: p.phone,
            whatsapp: p.whatsapp,
            public_email: p.public_email,
            address_line1: p.address_line1,
            address_line2: p.address_line2,
            city: p.city,
            region: p.region,
            country_code: p.country_code,
            latitude: p.latitude,
            longitude: p.longitude,
            timezone: p.timezone,
            show_phone: p.show_phone,
            show_whatsapp: p.show_whatsapp,
            show_email: p.show_email,
            show_address: p.show_address,
            show_badges: p.show_badges,
            show_booking: p.show_booking,
            show_offers: p.show_offers,
            show_hours: p.show_hours,
            is_published: p.is_published,
            created_at: p.created_at,
            updated_at: p.updated_at,
        }
    }

    fn grant_from_proto(p: ProtoGrantResponse) -> OrgProfileFieldGrantResponse {
        OrgProfileFieldGrantResponse {
            id: p.id,
            profile_id: p.profile_id,
            field: p.field,
            grantee_account_id: p.grantee_account_id,
            grantee_organization_id: p.grantee_organization_id,
            created_at: p.created_at,
            revoked_at: p.revoked_at,
        }
    }

    async fn client() -> Result<OrganizationProfilesApiServiceClient<tonic::transport::Channel>> {
        let url = std::env::var("ORG_PROFILES_SERVICE_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:50084".to_string());
        OrganizationProfilesApiServiceClient::connect(url)
            .await
            .map_err(|e| anyhow!("organization_profiles service unreachable: {e}"))
    }

    /// Create a profile for an organization.
    pub async fn create_for_organization(
        &self,
        account_id: &str,
        organization_id: &str,
        req: &CreateOrgProfileRequest,
    ) -> Result<OrgProfileResponse> {
        let mut client = Self::client().await?;
        let r = client
            .create_for_organization(ProtoCreateReq {
                account_id: account_id.to_string(),
                organization_id: organization_id.to_string(),
                slug: req.slug.clone(),
                display_name: req.display_name.clone(),
                headline: req.headline.clone(),
                category: req.category.clone(),
                bio: req.bio.clone(),
                phone: req.phone.clone(),
                whatsapp: req.whatsapp.clone(),
                public_email: req.public_email.clone(),
                address_line1: req.address_line1.clone(),
                address_line2: req.address_line2.clone(),
                city: req.city.clone(),
                region: req.region.clone(),
                country_code: req.country_code.clone(),
                latitude: req.latitude,
                longitude: req.longitude,
                timezone: req.timezone.clone(),
                show_phone: req.show_phone,
                show_whatsapp: req.show_whatsapp,
                show_email: req.show_email,
                show_address: req.show_address,
                show_badges: req.show_badges,
                show_booking: req.show_booking,
                show_offers: req.show_offers,
                show_hours: req.show_hours,
                is_published: req.is_published,
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::profile_from_proto(r.into_inner()))
    }

    /// Get the organization's profile.
    pub async fn get_for_organization(
        &self,
        account_id: &str,
        organization_id: &str,
    ) -> Result<OrgProfileResponse> {
        let mut client = Self::client().await?;
        let r = client
            .get_for_organization(OrgIdRequest {
                account_id: account_id.to_string(),
                organization_id: organization_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::profile_from_proto(r.into_inner()))
    }

    /// Update the organization's profile.
    pub async fn update_for_organization(
        &self,
        account_id: &str,
        organization_id: &str,
        req: &UpdateOrgProfileRequest,
    ) -> Result<OrgProfileResponse> {
        let mut client = Self::client().await?;
        let r = client
            .update_for_organization(ProtoUpdateReq {
                account_id: account_id.to_string(),
                organization_id: organization_id.to_string(),
                display_name: req.display_name.clone(),
                headline: req.headline.clone(),
                category: req.category.clone(),
                bio: req.bio.clone().flatten(),
                phone: req.phone.clone(),
                whatsapp: req.whatsapp.clone(),
                public_email: req.public_email.clone(),
                address_line1: req.address_line1.clone(),
                address_line2: req.address_line2.clone(),
                city: req.city.clone(),
                region: req.region.clone(),
                country_code: req.country_code.clone(),
                latitude: req.latitude,
                longitude: req.longitude,
                timezone: req.timezone.clone(),
                show_phone: req.show_phone,
                show_whatsapp: req.show_whatsapp,
                show_email: req.show_email,
                show_address: req.show_address,
                show_badges: req.show_badges,
                show_booking: req.show_booking,
                show_offers: req.show_offers,
                show_hours: req.show_hours,
                is_published: req.is_published,
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::profile_from_proto(r.into_inner()))
    }

    /// Create a field grant for the organization's profile.
    pub async fn create_grant_for_organization(
        &self,
        account_id: &str,
        organization_id: &str,
        req: &CreateOrgGrantRequest,
    ) -> Result<OrgProfileFieldGrantResponse> {
        let mut client = Self::client().await?;
        let r = client
            .create_grant_for_organization(ProtoCreateGrantReq {
                account_id: account_id.to_string(),
                organization_id: organization_id.to_string(),
                grantee_slug: req.grantee_slug.clone(),
                field: req.field.clone(),
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::grant_from_proto(r.into_inner()))
    }

    /// List field grants for the organization's profile.
    pub async fn list_grants_for_organization(
        &self,
        account_id: &str,
        organization_id: &str,
    ) -> Result<Vec<OrgProfileFieldGrantResponse>> {
        let mut client = Self::client().await?;
        let r = client
            .list_grants_for_organization(OrgIdRequest {
                account_id: account_id.to_string(),
                organization_id: organization_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(r.into_inner()
            .grants
            .into_iter()
            .map(Self::grant_from_proto)
            .collect())
    }

    /// Revoke a field grant for the organization's profile.
    pub async fn revoke_grant_for_organization(
        &self,
        account_id: &str,
        organization_id: &str,
        grant_id: &str,
    ) -> Result<OrgProfileFieldGrantResponse> {
        let mut client = Self::client().await?;
        let r = client
            .revoke_grant_for_organization(RevokeGrantRequest {
                account_id: account_id.to_string(),
                organization_id: organization_id.to_string(),
                grant_id: grant_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!("gRPC error: {e}"))?;
        Ok(Self::grant_from_proto(r.into_inner()))
    }
}
