//! Organizations service — business logic for organization operations.
//!
//! Mirrors `apps/api/src/modules/organizations/organizations.service.ts`.

use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use deadpool_postgres::Object;
use sqlx::{FromRow, Row};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::organizations::dto::{
    BeneficialOwnerResponse, MembershipResponse, MessageResponse, OrganizationResponse,
};

#[derive(Debug, Clone, FromRow)]
pub struct OrganizationRow {
    pub id: String,
    pub tenant_id: String,
    pub subject_id: String,
    pub legal_name: String,
    pub registration_number: Option<String>,
    pub country_code: Option<String>,
    pub address: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub struct OrganizationsService {
    db: DbPool,
    env: AppEnv,
}

impl OrganizationsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    fn row_to_response(row: OrganizationRow) -> OrganizationResponse {
        OrganizationResponse {
            id: row.id,
            tenant_id: row.tenant_id,
            subject_id: row.subject_id,
            legal_name: row.legal_name,
            registration_number: row.registration_number,
            country_code: row.country_code,
            address: row.address,
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
        }
    }

    pub async fn create(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        req: &crate::modules::organizations::dto::CreateOrganizationRequest,
    ) -> Result<OrganizationResponse> {
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1").bind(tenant_id).execute(&mut *conn).await?;

        // Verify subject exists and is ORGANIZATION type
        let subject_type: String = sqlx::query_scalar(
            "SELECT type FROM subject WHERE id = $1",
        )
        .bind(&req.subject_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Subject not found"))?;

        if subject_type != "ORGANIZATION" {
            return Err(anyhow!("Subject must be of type ORGANIZATION"));
        }

        let org: OrganizationRow = sqlx::query_as(
            r#"
            INSERT INTO organization (id, tenant_id, subject_id, legal_name, registration_number, country_code, address)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
            RETURNING id, tenant_id, subject_id, legal_name, registration_number, country_code, address, created_at, updated_at
            "#,
        )
        .bind(tenant_id)
        .bind(&req.subject_id)
        .bind(&req.legal_name)
        .bind(&req.registration_number)
        .bind(&req.country_code)
        .bind(&req.address)
        .fetch_one(&mut *conn)
        .await?;

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, metadata)
            VALUES (gen_random_uuid(), $1, 'API_KEY', $2, 'organization.create', NULL)
            "#,
        )
        .bind(tenant_id)
        .bind(api_key_id)
        .execute(&mut *conn)
        .await?;

        Ok(Self::row_to_response(org))
    }

    pub async fn list_all(&self, tenant_id: &str) -> Result<Vec<OrganizationResponse>> {
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1").bind(tenant_id).execute(&mut *conn).await?;

        let rows: Vec<OrganizationRow> = sqlx::query_as(
            "SELECT id, tenant_id, subject_id, legal_name, registration_number, country_code, address, created_at, updated_at FROM organization ORDER BY created_at DESC",
        )
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(Self::row_to_response).collect())
    }

    pub async fn get_by_id(&self, tenant_id: &str, org_id: &str) -> Result<OrganizationResponse> {
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1").bind(tenant_id).execute(&mut *conn).await?;

        let org: OrganizationRow = sqlx::query_as(
            "SELECT id, tenant_id, subject_id, legal_name, registration_number, country_code, address, created_at, updated_at FROM organization WHERE id = $1",
        )
        .bind(org_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Organization not found"))?;

        Ok(Self::row_to_response(org))
    }

    pub async fn list_memberships(&self, tenant_id: &str, org_id: &str) -> Result<Vec<MembershipResponse>> {
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1").bind(tenant_id).execute(&mut *conn).await?;

        // Verify org exists
        let exists: bool = sqlx::query("SELECT EXISTS(SELECT 1 FROM organization WHERE id = $1)")
            .bind(org_id)
            .fetch_one(&mut *conn)
            .await?
            .get(0);
        if !exists {
            return Err(anyhow!("Organization not found"));
        }

        let rows = sqlx::query(
            r#"
            SELECT id, tenant_id, organization_id, subject_id, role, status, phone, account_id, created_at
            FROM organization_membership
            WHERE organization_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(org_id)
        .fetch_all(&mut *conn)
        .await?;

        let memberships: Vec<MembershipResponse> = rows
            .into_iter()
            .map(|row| MembershipResponse {
                id: row.get("id"),
                tenant_id: row.get("tenant_id"),
                organization_id: row.get("organization_id"),
                subject_id: row.get("subject_id"),
                role: row.get("role"),
                status: row.get("status"),
                phone: row.get("phone"),
                account_id: row.get("account_id"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            })
            .collect();

        Ok(memberships)
    }

    pub async fn invite_member(
        &self,
        tenant_id: &str,
        org_id: &str,
        phone: &str,
        role: &str,
    ) -> Result<MembershipResponse> {
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1").bind(tenant_id).execute(&mut *conn).await?;

        // Verify org exists
        let exists: bool = sqlx::query("SELECT EXISTS(SELECT 1 FROM organization WHERE id = $1)")
            .bind(org_id)
            .fetch_one(&mut *conn)
            .await?
            .get(0);
        if !exists {
            return Err(anyhow!("Organization not found"));
        }

        let membership: (String, String, String, String, String, String, Option<String>, Option<String>, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
            r#"
            INSERT INTO organization_membership (id, tenant_id, organization_id, subject_id, role, status, phone, created_at)
            VALUES (gen_random_uuid(), $1, $2, '', $3, 'PENDING', $4, now())
            RETURNING id, tenant_id, organization_id, subject_id, role, status, phone, account_id, created_at
            "#,
        )
        .bind(tenant_id)
        .bind(org_id)
        .bind(role)
        .bind(phone)
        .fetch_one(&mut *conn)
        .await?;

        Ok(MembershipResponse {
            id: membership.0,
            tenant_id: membership.1,
            organization_id: membership.2,
            subject_id: membership.3,
            role: membership.4,
            status: membership.5,
            phone: membership.6,
            account_id: membership.7,
            created_at: membership.8.to_rfc3339(),
        })
    }

    pub async fn list_beneficial_owners(&self, tenant_id: &str, org_id: &str) -> Result<Vec<BeneficialOwnerResponse>> {
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1").bind(tenant_id).execute(&mut *conn).await?;

        let rows = sqlx::query(
            r#"
            SELECT id, tenant_id, organization_id, person_subject_id, role, created_at
            FROM organization_beneficial_owner
            WHERE organization_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(org_id)
        .fetch_all(&mut *conn)
        .await?;

        let owners: Vec<BeneficialOwnerResponse> = rows
            .into_iter()
            .map(|row| BeneficialOwnerResponse {
                id: row.get("id"),
                tenant_id: row.get("tenant_id"),
                organization_id: row.get("organization_id"),
                person_subject_id: row.get("person_subject_id"),
                role: row.get("role"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            })
            .collect();

        Ok(owners)
    }

    // ── Account-session endpoints (mirrors TypeScript OrganizationsController) ──

    /// List organizations the account is an active member of — mirrors listMyMemberships().
    pub async fn list_my_memberships(&self, account_id: &str) -> Result<Vec<OrganizationResponse>> {
        let mut conn = self.db.get().await?;

        // Find the person subject for this account
        let subject_id: Option<String> = sqlx::query_scalar(
            "SELECT id FROM subject WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?;

        let subject_id = subject_id.ok_or_else(|| anyhow!("No subject found for account"))?;

        // Get active organization memberships
        let org_ids: Vec<String> = sqlx::query_scalar(
            "SELECT organization_id FROM organization_membership
             WHERE person_subject_id = $1 AND status = 'ACTIVE'",
        )
        .bind(&subject_id)
        .fetch_all(&mut *conn)
        .await?;

        let mut results = Vec::new();
        for org_id in org_ids {
            let org: OrganizationRow = sqlx::query_as(
                "SELECT id, tenant_id, subject_id, legal_name, registration_number, country_code, address, created_at, updated_at
                 FROM organization WHERE id = $1",
            )
            .bind(&org_id)
            .fetch_optional(&mut *conn)
            .await?
            .ok_or_else(|| anyhow!("Organization not found"))?;

            results.push(Self::row_to_response(org));
        }

        Ok(results)
    }

    /// List pending invites for an account — mirrors listMyInvites().
    pub async fn list_my_invites(&self, account_id: &str) -> Result<Vec<MembershipResponse>> {
        let mut conn = self.db.get().await?;

        // Find the person subject for this account
        let subject_id: Option<String> = sqlx::query_scalar(
            "SELECT id FROM subject WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?;

        let subject_id = subject_id.ok_or_else(|| anyhow!("No subject found for account"))?;

        // Get pending memberships for this subject
        let rows = sqlx::query(
            "SELECT id, tenant_id, organization_id, subject_id, role, status, phone, account_id, created_at
             FROM organization_membership
             WHERE person_subject_id = $1 AND status = 'PENDING'
             ORDER BY created_at DESC",
        )
        .bind(&subject_id)
        .fetch_all(&mut *conn)
        .await?;

        let invites: Vec<MembershipResponse> = rows
            .into_iter()
            .map(|row| MembershipResponse {
                id: row.get("id"),
                tenant_id: row.get("tenant_id"),
                organization_id: row.get("organization_id"),
                subject_id: row.get("subject_id"),
                role: row.get("role"),
                status: row.get("status"),
                phone: row.get("phone"),
                account_id: row.get("account_id"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            })
            .collect();

        Ok(invites)
    }

    /// Accept or decline an invite — mirrors respondToInvite().
    pub async fn respond_to_invite(
        &self,
        account_id: &str,
        membership_id: &str,
        response: &str,
    ) -> Result<MembershipResponse> {
        let mut conn = self.db.get().await?;

        // Find the person subject for this account
        let subject_id: Option<String> = sqlx::query_scalar(
            "SELECT id FROM subject WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?;

        let subject_id = subject_id.ok_or_else(|| anyhow!("No subject found for account"))?;

        // Verify membership exists and is pending
        let current_status: String = sqlx::query_scalar(
            "SELECT status FROM organization_membership WHERE id = $1",
        )
        .bind(membership_id)
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| anyhow!("Invite not found"))?;

        if current_status != "PENDING" {
            return Err(anyhow!("Invite is not pending"));
        }

        // Update the membership
        let membership: (String, String, String, String, String, String, Option<String>, Option<String>, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
            "UPDATE organization_membership
             SET status = $1, person_subject_id = $2, account_id = $3
             WHERE id = $4
             RETURNING id, tenant_id, organization_id, subject_id, role, status, phone, account_id, created_at",
        )
        .bind(response)
        .bind(&subject_id)
        .bind(account_id)
        .bind(membership_id)
        .fetch_one(&mut *conn)
        .await?;

        Ok(MembershipResponse {
            id: membership.0,
            tenant_id: membership.1,
            organization_id: membership.2,
            subject_id: membership.3,
            role: membership.4,
            status: membership.5,
            phone: membership.6,
            account_id: membership.7,
            created_at: membership.8.to_rfc3339(),
        })
    }
}
