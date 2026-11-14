//! Invitations service — business logic for invitation operations.

use anyhow::{anyhow, Result};
use chrono::{Duration, Utc};
use sqlx::{FromRow, Row};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::invitations::dto::InvitationResponse;

#[derive(Debug, Clone, FromRow)]
pub struct InvitationRow {
    pub id: String,
    pub tenant_id: String,
    pub email: Option<String>,
    pub username: Option<String>,
    pub invited_by: String,
    pub organization_id: Option<String>,
    pub brand_id: Option<String>,
    pub scope: String,
    pub role_definition_id: Option<String>,
    pub department_id: Option<String>,
    pub status: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub accepted_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub struct InvitationsService {
    db: DbPool,
    env: AppEnv,
}

impl InvitationsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    async fn require_owner_or_partner(&self, conn: &mut sqlx::PgConnection, account_id: &str, tenant_id: &str) -> Result<()> {
        let grant = sqlx::query(
            "SELECT id FROM access_grant WHERE account_id = $1 AND tenant_id = $2 AND access_type IN ('OWNER', 'PARTNER') AND status = 'ACTIVE'",
        )
        .bind(account_id)
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?;

        if grant.is_none() {
            return Err(anyhow!("Only tenant owners or partners can send invitations."));
        }
        Ok(())
    }

    async fn require_access(&self, conn: &mut sqlx::PgConnection, account_id: &str, tenant_id: &str) -> Result<()> {
        let grant = sqlx::query(
            "SELECT id FROM access_grant WHERE account_id = $1 AND tenant_id = $2 AND status = 'ACTIVE'",
        )
        .bind(account_id)
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?;

        if grant.is_none() {
            return Err(anyhow!("You do not have access to this tenant."));
        }
        Ok(())
    }

    fn row_to_response(row: InvitationRow) -> InvitationResponse {
        InvitationResponse {
            id: row.id,
            tenant_id: row.tenant_id,
            email: row.email,
            username: row.username,
            invited_by: row.invited_by,
            organization_id: row.organization_id,
            brand_id: row.brand_id,
            scope: row.scope,
            role_definition_id: row.role_definition_id,
            department_id: row.department_id,
            status: row.status,
            expires_at: row.expires_at.to_rfc3339(),
            accepted_at: row.accepted_at.map(|d| d.to_rfc3339()),
            created_at: row.created_at.to_rfc3339(),
        }
    }

    pub async fn send_email_invite(
        &self,
        caller_id: &str,
        tenant_id: &str,
        req: &crate::modules::invitations::dto::SendEmailInviteRequest,
    ) -> Result<InvitationResponse> {
        let mut conn = self.db.get().await?;
        self.require_owner_or_partner(&mut conn, caller_id, tenant_id).await?;

        let existing = sqlx::query(
            "SELECT id FROM invitation WHERE email = $1 AND tenant_id = $2 AND status = 'PENDING'",
        )
        .bind(&req.email)
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?;
        if existing.is_some() {
            return Err(anyhow!("A pending invitation already exists for this email."));
        }

        let scope = req.scope.as_deref().unwrap_or("TENANT");
        let expires_at = Utc::now() + Duration::days(7);

        let invite: InvitationRow = sqlx::query_as(
            r#"
            INSERT INTO invitation (id, tenant_id, email, invited_by, organization_id, brand_id, scope, role_definition_id, department_id, expires_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, tenant_id, email, username, invited_by, organization_id, brand_id, scope, role_definition_id, department_id, status, expires_at, accepted_at, created_at
            "#,
        )
        .bind(tenant_id)
        .bind(&req.email)
        .bind(caller_id)
        .bind(&req.organization_id)
        .bind(&req.brand_id)
        .bind(scope)
        .bind(&req.role_definition_id)
        .bind(&req.department_id)
        .bind(expires_at)
        .fetch_one(&mut *conn)
        .await?;

        Ok(Self::row_to_response(invite))
    }

    pub async fn send_username_invite(
        &self,
        caller_id: &str,
        tenant_id: &str,
        req: &crate::modules::invitations::dto::SendUsernameInviteRequest,
    ) -> Result<InvitationResponse> {
        let mut conn = self.db.get().await?;
        self.require_owner_or_partner(&mut conn, caller_id, tenant_id).await?;

        let target = sqlx::query("SELECT id FROM account WHERE phone = $1 OR email = $1")
            .bind(&req.username)
            .fetch_optional(&mut *conn)
            .await?;
        if target.is_none() {
            return Err(anyhow!("No account found with this username."));
        }

        let existing = sqlx::query(
            "SELECT id FROM invitation WHERE username = $1 AND tenant_id = $2 AND status = 'PENDING'",
        )
        .bind(&req.username)
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?;
        if existing.is_some() {
            return Err(anyhow!("A pending invitation already exists for this username."));
        }

        let scope = req.scope.as_deref().unwrap_or("TENANT");
        let expires_at = Utc::now() + Duration::days(7);

        let invite: InvitationRow = sqlx::query_as(
            r#"
            INSERT INTO invitation (id, tenant_id, username, invited_by, organization_id, brand_id, scope, role_definition_id, department_id, expires_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, tenant_id, email, username, invited_by, organization_id, brand_id, scope, role_definition_id, department_id, status, expires_at, accepted_at, created_at
            "#,
        )
        .bind(tenant_id)
        .bind(&req.username)
        .bind(caller_id)
        .bind(&req.organization_id)
        .bind(&req.brand_id)
        .bind(scope)
        .bind(&req.role_definition_id)
        .bind(&req.department_id)
        .bind(expires_at)
        .fetch_one(&mut *conn)
        .await?;

        Ok(Self::row_to_response(invite))
    }

    pub async fn accept_invitation(
        &self,
        account_id: &str,
        invitation_id: &str,
    ) -> Result<InvitationResponse> {
        let mut conn = self.db.get().await?;

        let invite: InvitationRow = sqlx::query_as(
            "SELECT id, tenant_id, email, username, invited_by, organization_id, brand_id, scope, role_definition_id, department_id, status, expires_at, accepted_at, created_at FROM invitation WHERE id = $1",
        )
        .bind(invitation_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Invitation not found."))?;

        if invite.status != "PENDING" {
            return Err(anyhow!("This invitation is no longer pending."));
        }

        if invite.expires_at < Utc::now() {
            sqlx::query("UPDATE invitation SET status = 'EXPIRED' WHERE id = $1")
                .bind(invitation_id)
                .execute(&mut *conn)
                .await?;
            return Err(anyhow!("This invitation has expired."));
        }

        let account: (Option<String>, Option<String>) = sqlx::query_as(
            "SELECT email, phone FROM account WHERE id = $1",
        )
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Account not found."))?;
        let (account_email, account_phone) = account;

        if let Some(ref email) = invite.email {
            if account_email.as_deref() != Some(email.as_str()) {
                return Err(anyhow!("This invitation is not for your account."));
            }
        }
        if let Some(ref username) = invite.username {
            if account_phone.as_deref() != Some(username.as_str()) && account_email.as_deref() != Some(username.as_str()) {
                return Err(anyhow!("This invitation is not for your account."));
            }
        }

        sqlx::query(
            "UPDATE invitation SET status = 'ACCEPTED', accepted_at = NOW(), accepted_by = $1 WHERE id = $2",
        )
        .bind(account_id)
        .bind(invitation_id)
        .execute(&mut *conn)
        .await?;

        // Create access grant
        let _scope = invite.scope.as_str();
        sqlx::query(
            r#"
            INSERT INTO access_grant (id, account_id, tenant_id, organization_id, brand_id, access_type, granted_by, status)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, 'MEMBER', $5, 'ACTIVE')
            "#,
        )
        .bind(account_id)
        .bind(&invite.tenant_id)
        .bind(&invite.organization_id)
        .bind(&invite.brand_id)
        .bind(&invite.invited_by)
        .execute(&mut *conn)
        .await?;

        if let Some(ref role_definition_id) = invite.role_definition_id {
            sqlx::query(
                r#"
                INSERT INTO role_assignment (id, account_id, role_definition_id, tenant_id, organization_id, brand_id, scope)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
                "#,
            )
            .bind(account_id)
            .bind(role_definition_id)
            .bind(&invite.tenant_id)
            .bind(&invite.organization_id)
            .bind(&invite.brand_id)
            .bind(&invite.scope)
            .execute(&mut *conn)
            .await?;
        }

        if let Some(ref department_id) = invite.department_id {
            sqlx::query(
                r#"
                INSERT INTO department_assignment (id, account_id, department_id, tenant_id, organization_id, brand_id, scope)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
                "#,
            )
            .bind(account_id)
            .bind(department_id)
            .bind(&invite.tenant_id)
            .bind(&invite.organization_id)
            .bind(&invite.brand_id)
            .bind(&invite.scope)
            .execute(&mut *conn)
            .await?;
        }

        let mut response = Self::row_to_response(invite);
        response.status = "ACCEPTED".to_string();
        response.accepted_at = Some(Utc::now().to_rfc3339());
        Ok(response)
    }

    pub async fn list_invitations(
        &self,
        caller_id: &str,
        tenant_id: &str,
        status: Option<&str>,
    ) -> Result<Vec<InvitationResponse>> {
        let mut conn = self.db.get().await?;
        self.require_access(&mut conn, caller_id, tenant_id).await?;

        let rows: Vec<InvitationRow> = if let Some(s) = status {
            sqlx::query_as(
                "SELECT id, tenant_id, email, username, invited_by, organization_id, brand_id, scope, role_definition_id, department_id, status, expires_at, accepted_at, created_at FROM invitation WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC",
            )
            .bind(tenant_id)
            .bind(s)
            .fetch_all(&mut *conn)
            .await?
        } else {
            sqlx::query_as(
                "SELECT id, tenant_id, email, username, invited_by, organization_id, brand_id, scope, role_definition_id, department_id, status, expires_at, accepted_at, created_at FROM invitation WHERE tenant_id = $1 ORDER BY created_at DESC",
            )
            .bind(tenant_id)
            .fetch_all(&mut *conn)
            .await?
        };

        Ok(rows.into_iter().map(Self::row_to_response).collect())
    }

    pub async fn revoke_invitation(&self, caller_id: &str, tenant_id: &str, invitation_id: &str) -> Result<()> {
        let mut conn = self.db.get().await?;
        self.require_owner_or_partner(&mut conn, caller_id, tenant_id).await?;

        let result = sqlx::query(
            "UPDATE invitation SET status = 'REVOKED' WHERE id = $1 AND tenant_id = $2 AND status = 'PENDING'",
        )
        .bind(invitation_id)
        .bind(tenant_id)
        .execute(&mut *conn)
        .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Invitation not found or already processed."));
        }

        Ok(())
    }
}
