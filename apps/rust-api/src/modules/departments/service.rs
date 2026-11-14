//! Departments service — business logic for department operations.
//!
//! Mirrors `apps/api/src/modules/department/department.service.ts`.

use anyhow::{anyhow, Result};
use sqlx::{FromRow, PgConnection};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::departments::dto::{
    AssignDepartmentRequest, DepartmentAssignmentResponse, DepartmentResponse,
};

#[derive(Debug, Clone, FromRow)]
pub struct DepartmentRow {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub slug: String,
    pub default_permissions: Option<serde_json::Value>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub inherited_from_tenant: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub struct DepartmentsService {
    db: DbPool,
    env: AppEnv,
}

impl DepartmentsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    fn row_to_response(row: DepartmentRow) -> DepartmentResponse {
        DepartmentResponse {
            id: row.id,
            tenant_id: row.tenant_id,
            name: row.name,
            slug: row.slug,
            default_permissions: row.default_permissions,
            icon: row.icon,
            color: row.color,
            inherited_from_tenant: row.inherited_from_tenant,
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
        }
    }

    async fn require_owner_or_partner(&self, conn: &mut PgConnection, account_id: &str, tenant_id: &str) -> Result<()> {
        let grant = sqlx::query(
            "SELECT id FROM access_grant WHERE account_id = $1 AND tenant_id = $2 AND access_type IN ('OWNER', 'PARTNER') AND status = 'ACTIVE'",
        )
        .bind(account_id)
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?;

        if grant.is_none() {
            return Err(anyhow!("Only tenant owners or partners can perform this action."));
        }
        Ok(())
    }

    async fn require_access(&self, conn: &mut PgConnection, account_id: &str, tenant_id: &str) -> Result<()> {
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

    pub async fn create_department(
        &self,
        account_id: &str,
        tenant_id: &str,
        req: &crate::modules::departments::dto::CreateDepartmentRequest,
    ) -> Result<DepartmentResponse> {
        let mut conn = self.db.get().await?;
        self.require_owner_or_partner(&mut conn, account_id, tenant_id).await?;

        let existing = sqlx::query("SELECT id FROM department WHERE tenant_id = $1 AND slug = $2")
            .bind(tenant_id)
            .bind(&req.slug)
            .fetch_optional(&mut *conn)
            .await?;
        if existing.is_some() {
            return Err(anyhow!("A department with slug \"{}\" already exists.", req.slug));
        }

        let dept: DepartmentRow = sqlx::query_as(
            r#"
            INSERT INTO department (id, tenant_id, name, slug, default_permissions, icon, color, inherited_from_tenant)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true)
            RETURNING id, tenant_id, name, slug, default_permissions, icon, color, inherited_from_tenant, created_at, updated_at
            "#,
        )
        .bind(tenant_id)
        .bind(&req.name)
        .bind(&req.slug)
        .bind(&req.default_permissions)
        .bind(&req.icon)
        .bind(&req.color)
        .fetch_one(&mut *conn)
        .await?;

        Ok(Self::row_to_response(dept))
    }

    pub async fn list_departments(&self, account_id: &str, tenant_id: &str) -> Result<Vec<DepartmentResponse>> {
        let mut conn = self.db.get().await?;
        self.require_access(&mut conn, account_id, tenant_id).await?;

        let rows: Vec<DepartmentRow> = sqlx::query_as(
            "SELECT id, tenant_id, name, slug, default_permissions, icon, color, inherited_from_tenant, created_at, updated_at FROM department WHERE tenant_id = $1 ORDER BY name",
        )
        .bind(tenant_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(Self::row_to_response).collect())
    }

    pub async fn get_department(&self, account_id: &str, tenant_id: &str, dept_id: &str) -> Result<DepartmentResponse> {
        let mut conn = self.db.get().await?;
        self.require_access(&mut conn, account_id, tenant_id).await?;

        let dept: DepartmentRow = sqlx::query_as(
            "SELECT id, tenant_id, name, slug, default_permissions, icon, color, inherited_from_tenant, created_at, updated_at FROM department WHERE id = $1 AND tenant_id = $2",
        )
        .bind(dept_id)
        .bind(tenant_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Department not found"))?;

        Ok(Self::row_to_response(dept))
    }

    pub async fn update_department(
        &self,
        account_id: &str,
        tenant_id: &str,
        dept_id: &str,
        req: &crate::modules::departments::dto::UpdateDepartmentRequest,
    ) -> Result<DepartmentResponse> {
        let mut conn = self.db.get().await?;
        self.require_owner_or_partner(&mut conn, account_id, tenant_id).await?;

        sqlx::query("SELECT id FROM department WHERE id = $1 AND tenant_id = $2")
            .bind(dept_id)
            .bind(tenant_id)
            .fetch_one(&mut *conn)
            .await
            .map_err(|_| anyhow!("Department not found"))?;

        let mut sets = Vec::new();
        let mut name_val: Option<String> = None;
        let mut perms_val: Option<&serde_json::Value> = None;
        let mut icon_val: Option<Option<String>> = None;
        let mut color_val: Option<Option<String>> = None;

        if let Some(ref n) = req.name {
            sets.push(format!("name = ${}", sets.len() + 1));
            name_val = Some(n.clone());
        }
        if req.default_permissions.is_some() {
            sets.push(format!("default_permissions = ${}", sets.len() + 1));
            perms_val = req.default_permissions.as_ref();
        }
        if req.icon.is_some() {
            sets.push(format!("icon = ${}", sets.len() + 1));
            icon_val = req.icon.clone();
        }
        if req.color.is_some() {
            sets.push(format!("color = ${}", sets.len() + 1));
            color_val = req.color.clone();
        }

        if sets.is_empty() {
            return self.get_department(account_id, tenant_id, dept_id).await;
        }

        let query = format!(
            "UPDATE department SET {} WHERE id = ${} AND tenant_id = ${} RETURNING id, tenant_id, name, slug, default_permissions, icon, color, inherited_from_tenant, created_at, updated_at",
            sets.join(", "),
            sets.len() + 1,
            sets.len() + 2,
        );
        let mut q = sqlx::query_as::<_, DepartmentRow>(&query);
        if let Some(v) = name_val { q = q.bind(v); }
        if let Some(v) = perms_val { q = q.bind(v); }
        if icon_val.is_some() { q = q.bind(icon_val); }
        if color_val.is_some() { q = q.bind(color_val); }
        let dept = q
            .bind(dept_id)
            .bind(tenant_id)
            .fetch_one(&mut *conn)
            .await
            .map_err(|_| anyhow!("Department not found"))?;

        Ok(Self::row_to_response(dept))
    }

    pub async fn assign_department(
        &self,
        account_id: &str,
        tenant_id: &str,
        dept_id: &str,
        req: &AssignDepartmentRequest,
    ) -> Result<DepartmentAssignmentResponse> {
        let mut conn = self.db.get().await?;
        self.require_owner_or_partner(&mut conn, account_id, tenant_id).await?;

        sqlx::query("SELECT id FROM department WHERE id = $1 AND tenant_id = $2")
            .bind(dept_id)
            .bind(tenant_id)
            .fetch_one(&mut *conn)
            .await
            .map_err(|_| anyhow!("Department not found"))?;

        sqlx::query("SELECT id FROM account WHERE id = $1")
            .bind(&req.account_id)
            .fetch_one(&mut *conn)
            .await
            .map_err(|_| anyhow!("Account not found"))?;

        let scope = req.scope.as_deref().unwrap_or_else(|| {
            if req.brand_id.is_some() { "BRAND" } else if req.organization_id.is_some() { "ORGANIZATION" } else { "TENANT" }
        });

        let existing = sqlx::query(
            "SELECT id FROM department_assignment WHERE account_id = $1 AND department_id = $2 AND scope = $3 AND organization_id IS NOT DISTINCT FROM $4 AND brand_id IS NOT DISTINCT FROM $5",
        )
        .bind(&req.account_id)
        .bind(dept_id)
        .bind(scope)
        .bind(&req.organization_id)
        .bind(&req.brand_id)
        .fetch_optional(&mut *conn)
        .await?;
        if existing.is_some() {
            return Err(anyhow!("This account is already assigned to this department at this scope."));
        }

        let assignment: (String, String, String, String, Option<String>, Option<String>, String, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
            r#"
            INSERT INTO department_assignment (id, account_id, department_id, tenant_id, organization_id, brand_id, scope)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
            RETURNING id, account_id, department_id, tenant_id, organization_id, brand_id, scope, created_at
            "#,
        )
        .bind(&req.account_id)
        .bind(dept_id)
        .bind(tenant_id)
        .bind(&req.organization_id)
        .bind(&req.brand_id)
        .bind(scope)
        .fetch_one(&mut *conn)
        .await?;

        Ok(DepartmentAssignmentResponse {
            id: assignment.0,
            account_id: assignment.1,
            department_id: assignment.2,
            tenant_id: assignment.3,
            organization_id: assignment.4,
            brand_id: assignment.5,
            scope: assignment.6,
            created_at: assignment.7.to_rfc3339(),
        })
    }

    pub async fn remove_department_assignment(
        &self,
        caller_account_id: &str,
        tenant_id: &str,
        dept_id: &str,
        account_id: &str,
    ) -> Result<()> {
        let mut conn = self.db.get().await?;
        self.require_owner_or_partner(&mut conn, caller_account_id, tenant_id).await?;

        sqlx::query(
            "DELETE FROM department_assignment WHERE department_id = $1 AND account_id = $2 AND tenant_id = $3",
        )
        .bind(dept_id)
        .bind(account_id)
        .bind(tenant_id)
        .execute(&mut *conn)
        .await?;

        Ok(())
    }

    pub async fn get_account_departments(
        &self,
        caller_account_id: &str,
        tenant_id: &str,
        account_id: &str,
    ) -> Result<Vec<DepartmentAssignmentResponse>> {
        let mut conn = self.db.get().await?;
        self.require_access(&mut conn, caller_account_id, tenant_id).await?;

        let rows: Vec<(String, String, String, String, Option<String>, Option<String>, String, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
            "SELECT id, account_id, department_id, tenant_id, organization_id, brand_id, scope, created_at FROM department_assignment WHERE account_id = $1 AND tenant_id = $2",
        )
        .bind(account_id)
        .bind(tenant_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| DepartmentAssignmentResponse {
            id: r.0,
            account_id: r.1,
            department_id: r.2,
            tenant_id: r.3,
            organization_id: r.4,
            brand_id: r.5,
            scope: r.6,
            created_at: r.7.to_rfc3339(),
        }).collect())
    }
}
