//! Tenant staff — business logic.
//!
//! Extracted from `apps/rust-api/src/modules/tenant_staff/service.rs`.
//! Plain `sqlx::PgPool` instead of `core::db::DbPool` -- this module
//! never used the tenant-scoped transaction helper that wrapper is for.

use anyhow::{anyhow, Result};
use serde::Serialize;
use sqlx::{FromRow, PgPool, Row};

#[derive(Debug, Clone, Serialize)]
pub struct StaffMemberResponse {
    pub id: String,
    pub tenant_id: String,
    pub account_id: String,
    pub role: String,
    pub phone: Option<String>,
    pub phone_verified: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, FromRow)]
struct StaffRow {
    id: String,
    tenant_id: String,
    account_id: String,
    role: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

pub struct TenantStaffService {
    db: PgPool,
}

impl TenantStaffService {
    /// Open a transaction with RLS context settings applied. They are
    /// transaction-local (`set_config(.., true)`), so they must be set on the
    /// transaction itself and are gone once it ends.
    async fn scoped(&self, settings: &[(&str, &str)]) -> Result<sqlx::Transaction<'_, sqlx::Postgres>> {
        let mut tx = self.db.begin().await?;
        for (k, v) in settings {
            sqlx::query("SELECT set_config($1, $2, true)")
                .bind(*k)
                .bind(*v)
                .execute(&mut *tx)
                .await?;
        }
        Ok(tx)
    }

    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn invite(&self, tenant_id: &str, account_id: &str, role: &str) -> Result<StaffMemberResponse> {
        let mut conn = self.scoped(&[("app.tenant_id", tenant_id)]).await?;
        let existing = sqlx::query("SELECT id FROM tenant_staff_membership WHERE tenant_id = $1 AND account_id = $2")
            .bind(tenant_id)
            .bind(account_id)
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
        .bind(account_id)
        .bind(role)
        .fetch_one(&mut *conn)
        .await?;

        let account = sqlx::query("SELECT phone, (phone_verified_at IS NOT NULL) AS phone_verified FROM account WHERE id = $1")
            .bind(&staff.account_id)
            .fetch_optional(&mut *conn)
            .await?;

        conn.commit().await?;
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

    pub async fn list(&self, tenant_id: &str) -> Result<Vec<StaffMemberResponse>> {
        let mut conn = self.scoped(&[("app.tenant_id", tenant_id)]).await?;
        let rows: Vec<(String, String, String, String, Option<String>, bool, chrono::DateTime<chrono::Utc>)> =
            sqlx::query_as(
                "SELECT m.id, m.tenant_id, m.account_id, m.role, a.phone, (a.phone_verified_at IS NOT NULL), m.created_at FROM tenant_staff_membership m LEFT JOIN account a ON m.account_id = a.id WHERE m.tenant_id = $1 ORDER BY m.created_at",
            )
            .bind(tenant_id)
            .fetch_all(&mut *conn)
            .await?;

        Ok(rows
            .into_iter()
            .map(|r| StaffMemberResponse {
                id: r.0,
                tenant_id: r.1,
                account_id: r.2,
                role: r.3,
                phone: r.4,
                phone_verified: r.5,
                created_at: r.6.to_rfc3339(),
            })
            .collect())
    }
}
