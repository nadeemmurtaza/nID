//! Organization Profiles service — org-owned profile management.
//!
//! Mirrors `apps/api/src/modules/profiles/organization-profiles.controller.ts`.
//! Every route requires AccountSessionGuard — an organization never authenticates
//! as itself; a person's Account, authorized by an ACTIVE + isAdmin OrganizationMembership,
//! acts for it.

use anyhow::{anyhow, Result};
use chrono::Utc;
use sqlx::{FromRow, Row};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::organization_profiles::dto::{
    CreateOrgGrantRequest, CreateOrgProfileRequest, OrgProfileFieldGrantResponse,
    OrgProfileResponse, UpdateOrgProfileRequest,
};

#[derive(Debug, Clone, FromRow)]
struct OrgProfileRow {
    id: String,
    organization_id: Option<String>,
    slug: String,
    display_name: String,
    headline: Option<String>,
    category: String,
    bio: Option<String>,
    photo_key: Option<String>,
    phone: Option<String>,
    whatsapp: Option<String>,
    public_email: Option<String>,
    address_line1: Option<String>,
    address_line2: Option<String>,
    city: Option<String>,
    region: Option<String>,
    country_code: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    timezone: String,
    show_phone: bool,
    show_whatsapp: bool,
    show_email: bool,
    show_address: bool,
    show_badges: bool,
    show_booking: bool,
    show_offers: bool,
    show_hours: bool,
    is_published: bool,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, FromRow)]
struct OrgMembershipRow {
    status: String,
    is_admin: bool,
}

#[derive(Debug, Clone, FromRow)]
struct OrgRow {
    id: String,
    is_verified: bool,
}

#[derive(Debug, Clone, FromRow)]
struct GrantRow {
    id: String,
    profile_id: String,
    field: String,
    grantee_account_id: Option<String>,
    grantee_organization_id: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
    revoked_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub struct OrganizationProfilesService {
    db: DbPool,
    env: AppEnv,
}

impl OrganizationProfilesService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    fn row_to_response(row: OrgProfileRow) -> OrgProfileResponse {
        OrgProfileResponse {
            id: row.id,
            organization_id: row.organization_id,
            slug: row.slug,
            display_name: row.display_name,
            headline: row.headline,
            category: row.category,
            bio: row.bio,
            photo_key: row.photo_key,
            phone: row.phone,
            whatsapp: row.whatsapp,
            public_email: row.public_email,
            address_line1: row.address_line1,
            address_line2: row.address_line2,
            city: row.city,
            region: row.region,
            country_code: row.country_code,
            latitude: row.latitude,
            longitude: row.longitude,
            timezone: row.timezone,
            show_phone: row.show_phone,
            show_whatsapp: row.show_whatsapp,
            show_email: row.show_email,
            show_address: row.show_address,
            show_badges: row.show_badges,
            show_booking: row.show_booking,
            show_offers: row.show_offers,
            show_hours: row.show_hours,
            is_published: row.is_published,
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
        }
    }

    /// Verify the account is an active admin of the organization.
    async fn require_active_admin(
        &self,
        account_id: &str,
        organization_id: &str,
        conn: &mut deadpool_postgres::Object,
    ) -> Result<()> {
        let org: OrgRow = sqlx::query_as(
            "SELECT id, is_verified FROM organization WHERE id = $1",
        )
        .bind(organization_id)
        .fetch_one(&mut **conn)
        .await
        .map_err(|_| anyhow!("Organization not found"))?;

        if !org.is_verified {
            return Err(anyhow!("Organization must be verified to manage profiles"));
        }

        let membership: OrgMembershipRow = sqlx::query_as(
            "SELECT status, is_admin FROM organization_membership
             WHERE organization_id = $1 AND account_id = $2",
        )
        .bind(organization_id)
        .bind(account_id)
        .fetch_one(&mut **conn)
        .await
        .map_err(|_| anyhow!("You are not authorized to manage this organization's profile"))?;

        if membership.status != "ACTIVE" || !membership.is_admin {
            return Err(anyhow!("You are not authorized to manage this organization's profile"));
        }

        Ok(())
    }

    /// Create a profile for an organization.
    pub async fn create_for_organization(
        &self,
        account_id: &str,
        organization_id: &str,
        req: &CreateOrgProfileRequest,
    ) -> Result<OrgProfileResponse> {
        let conn = self.db.get().await?;
        self.require_active_admin(account_id, organization_id, &conn).await?;

        let now = Utc::now();
        let row: OrgProfileRow = sqlx::query_as(
            "INSERT INTO profile
             (organization_id, slug, display_name, headline, category, bio, phone, whatsapp,
              public_email, address_line1, address_line2, city, region, country_code,
              latitude, longitude, timezone, show_phone, show_whatsapp, show_email,
              show_address, show_badges, show_booking, show_offers, show_hours, is_published,
              created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
             RETURNING *",
        )
        .bind(organization_id)
        .bind(&req.slug)
        .bind(&req.display_name)
        .bind(&req.headline)
        .bind(req.category.as_deref().unwrap_or("GENERAL"))
        .bind(&req.bio)
        .bind(&req.phone)
        .bind(&req.whatsapp)
        .bind(&req.public_email)
        .bind(&req.address_line1)
        .bind(&req.address_line2)
        .bind(&req.city)
        .bind(&req.region)
        .bind(&req.country_code)
        .bind(req.latitude)
        .bind(req.longitude)
        .bind(req.timezone.as_deref().unwrap_or("UTC"))
        .bind(req.show_phone.unwrap_or(false))
        .bind(req.show_whatsapp.unwrap_or(false))
        .bind(req.show_email.unwrap_or(false))
        .bind(req.show_address.unwrap_or(false))
        .bind(req.show_badges.unwrap_or(false))
        .bind(req.show_booking.unwrap_or(false))
        .bind(req.show_offers.unwrap_or(false))
        .bind(req.show_hours.unwrap_or(false))
        .bind(req.is_published.unwrap_or(false))
        .bind(now)
        .bind(now)
        .fetch_one(&mut *conn)
        .await?;

        Ok(Self::row_to_response(row))
    }

    /// Get the organization's profile.
    pub async fn get_for_organization(
        &self,
        account_id: &str,
        organization_id: &str,
    ) -> Result<OrgProfileResponse> {
        let conn = self.db.get().await?;
        self.require_active_admin(account_id, organization_id, &conn).await?;

        let row: OrgProfileRow = sqlx::query_as(
            "SELECT * FROM profile WHERE organization_id = $1",
        )
        .bind(organization_id)
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| anyhow!("Organization profile not found"))?;

        Ok(Self::row_to_response(row))
    }

    /// Update the organization's profile.
    pub async fn update_for_organization(
        &self,
        account_id: &str,
        organization_id: &str,
        req: &UpdateOrgProfileRequest,
    ) -> Result<OrgProfileResponse> {
        let conn = self.db.get().await?;
        self.require_active_admin(account_id, organization_id, &conn).await?;

        let mut sets = Vec::new();
        let mut params: Vec<Box<dyn sqlx::types::Type<sqlx::Postgres> + sqlx::Encode<'_, sqlx::Postgres>>> = Vec::new();
        let idx = 2; // $1 is organization_id

        // Build dynamic SET clause
        let mut set_parts = Vec::new();
        if let Some(ref v) = req.display_name {
            set_parts.push(format!("display_name = ${}", idx));
            params.push(Box::new(v.clone()));
        }
        if let Some(ref v) = req.headline {
            set_parts.push(format!("headline = ${}", idx + params.len()));
            params.push(Box::new(v.clone()));
        }
        if let Some(ref v) = req.category {
            set_parts.push(format!("category = ${}", idx + params.len()));
            params.push(Box::new(v.clone()));
        }
        if let Some(ref v) = req.bio {
            set_parts.push(format!("bio = ${}", idx + params.len()));
            params.push(Box::new(v.clone()));
        }
        if let Some(ref v) = req.phone {
            set_parts.push(format!("phone = ${}", idx + params.len()));
            params.push(Box::new(v.clone()));
        }
        if let Some(ref v) = req.whatsapp {
            set_parts.push(format!("whatsapp = ${}", idx + params.len()));
            params.push(Box::new(v.clone()));
        }
        if let Some(ref v) = req.public_email {
            set_parts.push(format!("public_email = ${}", idx + params.len()));
            params.push(Box::new(v.clone()));
        }
        if let Some(ref v) = req.address_line1 {
            set_parts.push(format!("address_line1 = ${}", idx + params.len()));
            params.push(Box::new(v.clone()));
        }
        if let Some(ref v) = req.address_line2 {
            set_parts.push(format!("address_line2 = ${}", idx + params.len()));
            params.push(Box::new(v.clone()));
        }
        if let Some(ref v) = req.city {
            set_parts.push(format!("city = ${}", idx + params.len()));
            params.push(Box::new(v.clone()));
        }
        if let Some(ref v) = req.region {
            set_parts.push(format!("region = ${}", idx + params.len()));
            params.push(Box::new(v.clone()));
        }
        if let Some(ref v) = req.country_code {
            set_parts.push(format!("country_code = ${}", idx + params.len()));
            params.push(Box::new(v.clone()));
        }
        if let Some(v) = req.latitude {
            set_parts.push(format!("latitude = ${}", idx + params.len()));
            params.push(Box::new(v));
        }
        if let Some(v) = req.longitude {
            set_parts.push(format!("longitude = ${}", idx + params.len()));
            params.push(Box::new(v));
        }
        if let Some(ref v) = req.timezone {
            set_parts.push(format!("timezone = ${}", idx + params.len()));
            params.push(Box::new(v.clone()));
        }
        if let Some(v) = req.show_phone {
            set_parts.push(format!("show_phone = ${}", idx + params.len()));
            params.push(Box::new(v));
        }
        if let Some(v) = req.show_whatsapp {
            set_parts.push(format!("show_whatsapp = ${}", idx + params.len()));
            params.push(Box::new(v));
        }
        if let Some(v) = req.show_email {
            set_parts.push(format!("show_email = ${}", idx + params.len()));
            params.push(Box::new(v));
        }
        if let Some(v) = req.show_address {
            set_parts.push(format!("show_address = ${}", idx + params.len()));
            params.push(Box::new(v));
        }
        if let Some(v) = req.show_badges {
            set_parts.push(format!("show_badges = ${}", idx + params.len()));
            params.push(Box::new(v));
        }
        if let Some(v) = req.show_booking {
            set_parts.push(format!("show_booking = ${}", idx + params.len()));
            params.push(Box::new(v));
        }
        if let Some(v) = req.show_offers {
            set_parts.push(format!("show_offers = ${}", idx + params.len()));
            params.push(Box::new(v));
        }
        if let Some(v) = req.show_hours {
            set_parts.push(format!("show_hours = ${}", idx + params.len()));
            params.push(Box::new(v));
        }
        if let Some(v) = req.is_published {
            set_parts.push(format!("is_published = ${}", idx + params.len()));
            params.push(Box::new(v));
        }

        if set_parts.is_empty() {
            return self.get_for_organization(account_id, organization_id).await;
        }

        set_parts.push(format!("updated_at = ${}", idx + params.len()));
        params.push(Box::new(Utc::now()));

        let set_clause = set_parts.join(", ");
        let query = format!(
            "UPDATE profile SET {} WHERE organization_id = $1 RETURNING *",
            set_clause
        );

        // Use a simpler approach with explicit query
        let row: OrgProfileRow = sqlx::query_as(&query)
            .bind(organization_id)
            .persistent()
            .fetch_one(&mut *conn)
            .await
            .map_err(|_| anyhow!("Organization profile not found"))?;

        Ok(Self::row_to_response(row))
    }

    /// Create a field grant for the organization's profile.
    pub async fn create_grant_for_organization(
        &self,
        account_id: &str,
        organization_id: &str,
        req: &CreateOrgGrantRequest,
    ) -> Result<OrgProfileFieldGrantResponse> {
        let conn = self.db.get().await?;
        self.require_active_admin(account_id, organization_id, &conn).await?;

        let profile: (String,) = sqlx::query_as(
            "SELECT id FROM profile WHERE organization_id = $1",
        )
        .bind(organization_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Organization profile not found"))?;

        let grantee_account_id: Option<String> = sqlx::query_scalar(
            "SELECT account_id FROM profile_field_grant WHERE profile_id = $1 AND grantee_account_id IS NOT NULL LIMIT 1",
        )
        .bind(&profile.0)
        .fetch_optional(&mut *conn)
        .await?;

        let grantee_organization_id: Option<String> = sqlx::query_scalar(
            "SELECT organization_id FROM profile_field_grant WHERE profile_id = $1 AND grantee_organization_id IS NOT NULL LIMIT 1",
        )
        .bind(&profile.0)
        .fetch_optional(&mut *conn)
        .await?;

        let now = Utc::now();
        let grant: GrantRow = sqlx::query_as(
            "INSERT INTO profile_field_grant (profile_id, field, grantee_account_id, grantee_organization_id, created_at)
             VALUES ($1, $2, $3, $4, $5) RETURNING *",
        )
        .bind(&profile.0)
        .bind(&req.field)
        .bind(&grantee_account_id)
        .bind(&grantee_organization_id)
        .bind(now)
        .fetch_one(&mut *conn)
        .await?;

        Ok(grant_to_response(grant))
    }

    /// List field grants for the organization's profile.
    pub async fn list_grants_for_organization(
        &self,
        account_id: &str,
        organization_id: &str,
    ) -> Result<Vec<OrgProfileFieldGrantResponse>> {
        let conn = self.db.get().await?;
        self.require_active_admin(account_id, organization_id, &conn).await?;

        let profile: (String,) = sqlx::query_as(
            "SELECT id FROM profile WHERE organization_id = $1",
        )
        .bind(organization_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Organization profile not found"))?;

        let grants: Vec<GrantRow> = sqlx::query_as(
            "SELECT * FROM profile_field_grant WHERE profile_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC",
        )
        .bind(&profile.0)
        .fetch_all(&mut *conn)
        .await?;

        Ok(grants.into_iter().map(grant_to_response).collect())
    }

    /// Revoke a field grant for the organization's profile.
    pub async fn revoke_grant_for_organization(
        &self,
        account_id: &str,
        organization_id: &str,
        grant_id: &str,
    ) -> Result<OrgProfileFieldGrantResponse> {
        let conn = self.db.get().await?;
        self.require_active_admin(account_id, organization_id, &conn).await?;

        let now = Utc::now();
        let grant: GrantRow = sqlx::query_as(
            "UPDATE profile_field_grant SET revoked_at = $1 WHERE id = $2 AND profile_id IN (SELECT id FROM profile WHERE organization_id = $3) RETURNING *",
        )
        .bind(now)
        .bind(grant_id)
        .bind(organization_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Grant not found"))?;

        Ok(grant_to_response(grant))
    }
}

fn grant_to_response(grant: GrantRow) -> OrgProfileFieldGrantResponse {
    OrgProfileFieldGrantResponse {
        id: grant.id,
        profile_id: grant.profile_id,
        field: grant.field,
        grantee_account_id: grant.grantee_account_id,
        grantee_organization_id: grant.grantee_organization_id,
        created_at: grant.created_at.to_rfc3339(),
        revoked_at: grant.revoked_at.map(|d| d.to_rfc3339()),
    }
}
