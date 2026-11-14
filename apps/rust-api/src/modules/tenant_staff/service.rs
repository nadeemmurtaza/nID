//! Tenant staff service — business logic for tenant staff operations.

use anyhow::{anyhow, Result};
use sqlx::{FromRow, Row};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::tenant_staff::dto::StaffMemberResponse;

#[derive(Debug, Clone, FromRow)]
pub struct StaffRow {
    pub id: String,
    pub tenant_id: String,
    pub account_id: String,
    pub role: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub struct TenantStaffService {
    db: DbPool,
    env: AppEnv,
}

impl TenantStaffService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn invite(&self, tenant_id: &str, api_key_id: &str, req: &crate::modules::tenant_staff::dto::InviteStaffRequest) -> Result<StaffMemberResponse> {
        let mut conn = self.db.get().await?;

        // Check if already staff
        let existing = sqlx::query(
            "SELECT id FROM tenant_staff_membership WHERE tenant_id = $1 AND account_id = $2",
        )
        .bind(tenant_id)
        .bind(&req.account_id)
        .fetch_optional(&mut *conn)
        .await?;

        if existing.is_some() {
            return Err(anyhow!("Account is already a staff member of this tenant."));
        }

        let staff: StaffRow = sqlx::query_as(
            r#"
            INSERT INTO tenant_staff_membership (id, tenant_id, account_id, role)
            VALUES (gen_random_uuid(), $1, $2, $3)
            RETURNING id, tenant_id, account_id, role, created_at
            "#,
        )
        .bind(tenant_id)
        .bind(&req.account_id)
        .bind(&req.role)
        .fetch_one(&mut *conn)
        .await?;

        // Get account info
        let account = sqlx::query(
            "SELECT phone, phone_verified FROM account WHERE id = $1",
        )
        .bind(&staff.account_id)
        .fetch_optional(&mut *conn)
        .await?;

        Ok(StaffMemberResponse {
            id: staff.id,
            tenant_id: staff.tenant_id,
            account_id: staff.account_id,
            role: staff.role,
            phone: account.as_ref().and_then(|a| a.get::<Option<String>, _>("phone")),
            phone_verified: account.as_ref().map(|a| a.get::<bool, _>("phone_verified")).unwrap_or(false),
            created_at: staff.created_at.to_rfc3339(),
        })
    }

    pub async fn list(&self, tenant_id: &str, _api_key_id: &str) -> Result<Vec<StaffMemberResponse>> {
        let mut conn = self.db.get().await?;

        let rows: Vec<(String, String, String, String, Option<String>, bool, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
            "SELECT m.id, m.tenant_id, m.account_id, m.role, a.phone, COALESCE(a.phone_verified, false), m.created_at FROM tenant_staff_membership m LEFT JOIN account a ON m.account_id = a.id WHERE m.tenant_id = $1 ORDER BY m.created_at",
        )
        .bind(tenant_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| StaffMemberResponse {
            id: r.0,
            tenant_id: r.1,
            account_id: r.2,
            role: r.3,
            phone: r.4,
            phone_verified: r.5,
            created_at: r.6.to_rfc3339(),
        }).collect())
    }
}
