//! Access service — business logic for access control operations.
//!
//! Mirrors `apps/api/src/modules/access/access.service.ts`.

use anyhow::{anyhow, Context, Result};
use deadpool_postgres::Object;
use sqlx::{FromRow, Row};
use tracing::info;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::access::dto::{
    AccessGrantResponse, AccessType, AccessGrantStatus, MyPermissionsResponse, PermissionEntry,
};

/// Access grant row from database
#[derive(Debug, Clone, FromRow)]
pub struct AccessGrantRow {
    pub id: String,
    pub account_id: String,
    pub tenant_id: String,
    pub organization_id: Option<String>,
    pub brand_id: Option<String>,
    pub access_type: String,
    pub partnership_percentage: Option<f64>,
    pub granted_by: String,
    pub status: String,
    pub granted_at: chrono::DateTime<chrono::Utc>,
}

/// Account info for grant response
#[derive(Debug, Clone, FromRow)]
pub struct AccountInfoRow {
    pub id: String,
    pub phone: Option<String>,
    pub email: Option<String>,
}

/// Access service
pub struct AccessService {
    db: DbPool,
    env: AppEnv,
}

impl AccessService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    fn row_to_response(
        row: AccessGrantRow,
        phone: Option<String>,
        email: Option<String>,
    ) -> AccessGrantResponse {
        AccessGrantResponse {
            id: row.id,
            account_id: row.account_id,
            tenant_id: row.tenant_id,
            organization_id: row.organization_id,
            brand_id: row.brand_id,
            access_type: row.access_type,
            partnership_percentage: row.partnership_percentage,
            granted_by: row.granted_by,
            status: row.status,
            granted_at: row.granted_at.to_rfc3339(),
            account_phone: phone,
            account_email: email,
        }
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

    /// Verify caller is owner or partner of the tenant
    async fn verify_caller_is_owner_or_partner(&self, conn: &mut Object, caller_id: &str, tenant_id: &str) -> Result<()> {
        let grant = sqlx::query_as::<_, AccessGrantRow>(
            "SELECT id, account_id, tenant_id, organization_id, brand_id, access_type, partnership_percentage, granted_by, status, granted_at FROM access_grant WHERE account_id = $1 AND tenant_id = $2 AND access_type IN ('OWNER', 'PARTNER') AND status = 'ACTIVE' LIMIT 1",
        )
        .bind(caller_id)
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?;

        if grant.is_none() {
            return Err(anyhow!("Only tenant owners or partners can perform this action."));
        }
        Ok(())
    }

    /// Create an access grant
    pub async fn create_grant(
        &self,
        caller_id: &str,
        tenant_id: &str,
        req: &crate::modules::access::dto::CreateGrantRequest,
    ) -> Result<AccessGrantResponse> {
        let mut conn = self.db.get().await?;

        self.verify_caller_is_owner_or_partner(&mut conn, caller_id, tenant_id).await?;

        // Validate partnership percentage
        if let AccessType::Partner = &req.access_type {
            if req.partnership_percentage.is_none() || req.partnership_percentage.unwrap() <= 0.0 || req.partnership_percentage.unwrap() > 100.0 {
                return Err(anyhow!("Partnership percentage must be between 0 and 100 for PARTNER access type."));
            }
        }

        // Prevent self-grant
        if req.account_id == caller_id {
            return Err(anyhow!("Cannot grant access to yourself."));
        }

        // Check for duplicate grant
        let existing = sqlx::query(
            "SELECT id FROM access_grant WHERE account_id = $1 AND tenant_id = $2 AND organization_id = $3 AND brand_id = $4",
        )
        .bind(&req.account_id)
        .bind(tenant_id)
        .bind(&req.organization_id)
        .bind(&req.brand_id)
        .fetch_optional(&mut *conn)
        .await?;

        if existing.is_some() {
            return Err(anyhow!("This account already has an access grant at this scope."));
        }

        // Verify target account exists
        let target = sqlx::query_as::<_, AccountInfoRow>(
            "SELECT id, phone, email FROM account WHERE id = $1",
        )
        .bind(&req.account_id)
        .fetch_optional(&mut *conn)
        .await?;

        if target.is_none() {
            return Err(anyhow!("Target account not found."));
        }
        let target = target.unwrap();

        let type_str = Self::access_type_str(&req.access_type);

        let grant: AccessGrantRow = sqlx::query_as(
            r#"
            INSERT INTO access_grant (id, account_id, tenant_id, organization_id, brand_id, access_type, partnership_percentage, granted_by, status)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
            RETURNING id, account_id, tenant_id, organization_id, brand_id, access_type, partnership_percentage, granted_by, status, granted_at
            "#,
        )
        .bind(&req.account_id)
        .bind(tenant_id)
        .bind(&req.organization_id)
        .bind(&req.brand_id)
        .bind(type_str)
        .bind(req.partnership_percentage)
        .bind(caller_id)
        .fetch_one(&mut *conn)
        .await?;

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, subject_id, metadata)
            VALUES (gen_random_uuid(), $1, 'ACCOUNT', $2, 'access.grant_create', $3, NULL)
            "#,
        )
        .bind(tenant_id)
        .bind(caller_id)
        .bind(&grant.id)
        .execute(&mut *conn)
        .await?;

        Ok(Self::row_to_response(grant, target.phone, target.email))
    }

    /// List grants
    pub async fn list_grants(
        &self,
        caller_id: &str,
        tenant_id: &str,
        organization_id: Option<&str>,
        brand_id: Option<&str>,
    ) -> Result<Vec<AccessGrantResponse>> {
        let mut conn = self.db.get().await?;

        self.verify_caller_is_owner_or_partner(&mut conn, caller_id, tenant_id).await?;

        let mut query = String::from(
            "SELECT g.id, g.account_id, g.tenant_id, g.organization_id, g.brand_id, g.access_type, g.partnership_percentage, g.granted_by, g.status, g.granted_at, a.phone, a.email FROM access_grant g JOIN account a ON g.account_id = a.id WHERE g.tenant_id = $1 AND g.status = 'ACTIVE'",
        );
        let mut params: Vec<Box<dyn sqlx::encode::Encode<'_, sqlx::Postgres> + sqlx::types::Type<sqlx::Postgres>>> = vec![Box::new(tenant_id.to_string())];

        if organization_id.is_some() {
            query.push_str(" AND g.organization_id = $2");
            params.push(Box::new(organization_id.unwrap().to_string()));
        }
        if brand_id.is_some() {
            let param_idx = params.len() + 1;
            query.push_str(&format!(" AND g.brand_id = ${}", param_idx));
            params.push(Box::new(brand_id.unwrap().to_string()));
        }

        // Build the query with proper binds
        let grants = if organization_id.is_none() && brand_id.is_none() {
            sqlx::query_as::<_, (String, String, String, Option<String>, Option<String>, String, Option<f64>, String, String, chrono::DateTime<chrono::Utc>, Option<String>, Option<String>)>(
                &query,
            )
            .bind(tenant_id)
            .fetch_all(&mut *conn)
            .await?
        } else if organization_id.is_some() && brand_id.is_none() {
            sqlx::query_as::<_, (String, String, String, Option<String>, Option<String>, String, Option<f64>, String, String, chrono::DateTime<chrono::Utc>, Option<String>, Option<String>)>(
                &query,
            )
            .bind(tenant_id)
            .bind(organization_id.unwrap())
            .fetch_all(&mut *conn)
            .await?
        } else {
            sqlx::query_as::<_, (String, String, String, Option<String>, Option<String>, String, Option<f64>, String, String, chrono::DateTime<chrono::Utc>, Option<String>, Option<String>)>(
                &query,
            )
            .bind(tenant_id)
            .bind(organization_id.unwrap())
            .bind(brand_id.unwrap())
            .fetch_all(&mut *conn)
            .await?
        };

        Ok(grants.into_iter().map(|r| AccessGrantResponse {
            id: r.0,
            account_id: r.1,
            tenant_id: r.2,
            organization_id: r.3,
            brand_id: r.4,
            access_type: r.5,
            partnership_percentage: r.6,
            granted_by: r.7,
            status: r.8,
            granted_at: r.9.to_rfc3339(),
            account_phone: r.10,
            account_email: r.11,
        }).collect())
    }

    /// Get a single grant by ID
    pub async fn get_grant(&self, caller_id: &str, tenant_id: &str, grant_id: &str) -> Result<AccessGrantResponse> {
        let mut conn = self.db.get().await?;

        self.verify_caller_is_owner_or_partner(&mut conn, caller_id, tenant_id).await?;

        let row = sqlx::query_as::<_, (String, String, String, Option<String>, Option<String>, String, Option<f64>, String, String, chrono::DateTime<chrono::Utc>, Option<String>, Option<String>)>(
            "SELECT g.id, g.account_id, g.tenant_id, g.organization_id, g.brand_id, g.access_type, g.partnership_percentage, g.granted_by, g.status, g.granted_at, a.phone, a.email FROM access_grant g JOIN account a ON g.account_id = a.id WHERE g.id = $1",
        )
        .bind(grant_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Grant not found"))?;

        Ok(AccessGrantResponse {
            id: row.0,
            account_id: row.1,
            tenant_id: row.2,
            organization_id: row.3,
            brand_id: row.4,
            access_type: row.5,
            partnership_percentage: row.6,
            granted_by: row.7,
            status: row.8,
            granted_at: row.9.to_rfc3339(),
            account_phone: row.10,
            account_email: row.11,
        })
    }

    /// Update a grant
    pub async fn update_grant(
        &self,
        caller_id: &str,
        tenant_id: &str,
        grant_id: &str,
        req: &crate::modules::access::dto::UpdateGrantRequest,
    ) -> Result<AccessGrantResponse> {
        let mut conn = self.db.get().await?;

        self.verify_caller_is_owner_or_partner(&mut conn, caller_id, tenant_id).await?;

        let mut sets = Vec::new();
        let mut type_val: Option<String> = None;
        let mut pct_val: Option<f64> = None;
        let mut status_val: Option<String> = None;

        if let Some(ref t) = req.access_type {
            sets.push("access_type = $1");
            type_val = Some(Self::access_type_str(t).to_string());
        }
        if req.partnership_percentage.is_some() {
            let idx = sets.len() + 1;
            sets.push(&format!("partnership_percentage = ${}", idx));
            pct_val = req.partnership_percentage;
        }
        if let Some(ref s) = req.status {
            let idx = sets.len() + 1;
            sets.push(&format!("status = ${}", idx));
            status_val = Some(Self::status_str(s).to_string());
        }

        if sets.is_empty() {
            return self.get_grant(caller_id, tenant_id, grant_id).await;
        }

        let set_clause = sets.join(", ");
        let grant: AccessGrantRow = sqlx::query_as(
            &format!(
                "UPDATE access_grant SET {} WHERE id = ${} RETURNING id, account_id, tenant_id, organization_id, brand_id, access_type, partnership_percentage, granted_by, status, granted_at",
                set_clause,
                sets.len() + 1
            ),
        )
        .bind(&type_val)
        .bind(&pct_val)
        .bind(&status_val)
        .bind(grant_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Grant not found"))?;

        // Get account info
        let account = sqlx::query_as::<_, AccountInfoRow>(
            "SELECT id, phone, email FROM account WHERE id = $1",
        )
        .bind(&grant.account_id)
        .fetch_optional(&mut *conn)
        .await?;

        Ok(Self::row_to_response(
            grant,
            account.as_ref().and_then(|a| a.phone.clone()),
            account.as_ref().and_then(|a| a.email.clone()),
        ))
    }

    /// Revoke a grant
    pub async fn revoke_grant(&self, caller_id: &str, tenant_id: &str, grant_id: &str) -> Result<()> {
        let mut conn = self.db.get().await?;

        self.verify_caller_is_owner_or_partner(&mut conn, caller_id, tenant_id).await?;

        let result = sqlx::query(
            "UPDATE access_grant SET status = 'REVOKED' WHERE id = $1",
        )
        .bind(grant_id)
        .execute(&mut *conn)
        .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Grant not found."));
        }

        Ok(())
    }

    /// Transfer ownership
    pub async fn transfer_ownership(
        &self,
        caller_id: &str,
        tenant_id: &str,
        req: &crate::modules::access::dto::TransferOwnershipRequest,
    ) -> Result<AccessGrantResponse> {
        let mut conn = self.db.get().await?;

        self.verify_caller_is_owner_or_partner(&mut conn, caller_id, tenant_id).await?;

        // Find existing grant for new owner
        let grant = sqlx::query_as::<_, AccessGrantRow>(
            "SELECT id, account_id, tenant_id, organization_id, brand_id, access_type, partnership_percentage, granted_by, status, granted_at FROM access_grant WHERE account_id = $1 AND tenant_id = $2 AND organization_id = $3 AND brand_id = $4",
        )
        .bind(&req.new_owner_id)
        .bind(tenant_id)
        .bind(&req.organization_id)
        .bind(&req.brand_id)
        .fetch_optional(&mut *conn)
        .await?;

        if grant.is_none() {
            return Err(anyhow!("Target account does not have a grant at this scope."));
        }
        let mut grant = grant.unwrap();

        // Update to OWNER
        sqlx::query(
            "UPDATE access_grant SET access_type = 'OWNER', granted_by = $1 WHERE id = $2",
        )
        .bind(caller_id)
        .bind(&grant.id)
        .execute(&mut *conn)
        .await?;

        grant.access_type = "OWNER".to_string();
        grant.granted_by = caller_id.to_string();

        let account = sqlx::query_as::<_, AccountInfoRow>(
            "SELECT id, phone, email FROM account WHERE id = $1",
        )
        .bind(&grant.account_id)
        .fetch_optional(&mut *conn)
        .await?;

        Ok(Self::row_to_response(
            grant,
            account.as_ref().and_then(|a| a.phone.clone()),
            account.as_ref().and_then(|a| a.email.clone()),
        ))
    }

    /// Add partner
    pub async fn add_partner(
        &self,
        caller_id: &str,
        tenant_id: &str,
        account_id: &str,
        percentage: f64,
    ) -> Result<AccessGrantResponse> {
        let req = crate::modules::access::dto::CreateGrantRequest {
            account_id: account_id.to_string(),
            organization_id: None,
            brand_id: None,
            access_type: AccessType::Partner,
            partnership_percentage: Some(percentage),
        };
        self.create_grant(caller_id, tenant_id, &req).await
    }

    /// Get my permissions
    pub async fn get_my_permissions(
        &self,
        account_id: &str,
        tenant_id: &str,
        _organization_id: Option<&str>,
        _brand_id: Option<&str>,
    ) -> Result<MyPermissionsResponse> {
        let mut conn = self.db.get().await?;

        // Get all permissions from catalog
        let rows = sqlx::query(
            "SELECT group_name, service_name, permission_key, label FROM permission_catalog ORDER BY group_name, service_name, permission_key",
        )
        .fetch_all(&mut *conn)
        .await?;

        // Get the account's access type
        let grant = sqlx::query(
            "SELECT access_type FROM access_grant WHERE account_id = $1 AND tenant_id = $2 AND status = 'ACTIVE' LIMIT 1",
        )
        .bind(account_id)
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?;

        let access_type = grant.map(|r| r.get::<String, _>("access_type")).unwrap_or_else(|| "MEMBER".to_string());

        // OWNER and PARTNER get all permissions; ADMIN gets most; MEMBER gets basic
        let is_owner_or_partner = access_type == "OWNER" || access_type == "PARTNER";
        let is_admin = access_type == "ADMIN";

        let permissions: Vec<PermissionEntry> = rows
            .into_iter()
            .map(|row| PermissionEntry {
                group_name: row.get::<String, _>("group_name"),
                service_name: row.get::<String, _>("service_name"),
                permission_key: row.get::<String, _>("permission_key"),
                label: row.get::<String, _>("label"),
                granted: is_owner_or_partner || (is_admin && row.get::<String, _>("permission_key") != "manage_owners"),
            })
            .collect();

        Ok(MyPermissionsResponse {
            account_id: account_id.to_string(),
            tenant_id: tenant_id.to_string(),
            permissions,
        })
    }
}
