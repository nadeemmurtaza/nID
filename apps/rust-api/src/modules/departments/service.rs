//! Departments service — business logic for department operations.

use anyhow::{anyhow, Result};
use sqlx::{FromRow, Row};

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

    pub async fn create_department(
        &self,
        tenant_id: &str,
        req: &crate::modules::departments::dto::CreateDepartmentRequest,
    ) -> Result<DepartmentResponse> {
        let mut conn = self.db.get().await?;

        let dept: DepartmentRow = sqlx::query_as(
            r#"
            INSERT INTO department (id, tenant_id, name, slug, default_permissions, icon, color)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
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

    pub async fn list_departments(&self, tenant_id: &str) -> Result<Vec<DepartmentResponse>> {
        let mut conn = self.db.get().await?;

        let rows: Vec<DepartmentRow> = sqlx::query_as(
            "SELECT id, tenant_id, name, slug, default_permissions, icon, color, inherited_from_tenant, created_at, updated_at FROM department WHERE tenant_id = $1 ORDER BY name",
        )
        .bind(tenant_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(Self::row_to_response).collect())
    }

    pub async fn get_department(&self, tenant_id: &str, dept_id: &str) -> Result<DepartmentResponse> {
        let mut conn = self.db.get().await?;

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
        tenant_id: &str,
        dept_id: &str,
        req: &crate::modules::departments::dto::UpdateDepartmentRequest,
    ) -> Result<DepartmentResponse> {
        let mut conn = self.db.get().await?;

        let mut sets = Vec::new();
        let mut name_val: Option<String> = None;
        let mut perms_val: Option<&serde_json::Value> = None;
        let mut icon_val: Option<Option<String>> = None;
        let mut color_val: Option<Option<String>> = None;

        if let Some(ref n) = req.name {
            sets.push("name = $1");
            name_val = Some(n.clone());
        }
        if req.default_permissions.is_some() {
            let idx = sets.len() + 1;
            sets.push(&format!("default_permissions = ${}", idx));
            perms_val = req.default_permissions.as_ref();
        }
        if req.icon.is_some() {
            let idx = sets.len() + 1;
            sets.push(&format!("icon = ${}", idx));
            icon_val = req.icon;
        }
        if req.color.is_some() {
            let idx = sets.len() + 1;
            sets.push(&format!("color = ${}", idx));
            color_val = req.color;
        }

        if sets.is_empty() {
            return self.get_department(tenant_id, dept_id).await;
        }

        let dept: DepartmentRow = sqlx::query_as(
            &format!(
                "UPDATE department SET {} WHERE id = ${} AND tenant_id = ${} RETURNING id, tenant_id, name, slug, default_permissions, icon, color, inherited_from_tenant, created_at, updated_at",
                sets.join(", "),
                sets.len() + 1,
                sets.len() + 2,
            ),
        )
        .bind(&name_val)
        .bind(perms_val)
        .bind(&icon_val)
        .bind(&color_val)
        .bind(dept_id)
        .bind(tenant_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Department not found"))?;

        Ok(Self::row_to_response(dept))
    }

    pub async fn assign_department(
        &self,
        tenant_id: &str,
        dept_id: &str,
        req: &AssignDepartmentRequest,
    ) -> Result<DepartmentAssignmentResponse> {
        let mut conn = self.db.get().await?;

        let scope = req.scope.as_deref().unwrap_or("TENANT");

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
        tenant_id: &str,
        dept_id: &str,
        account_id: &str,
    ) -> Result<()> {
        let mut conn = self.db.get().await?;

        let result = sqlx::query(
            "DELETE FROM department_assignment WHERE department_id = $1 AND account_id = $2 AND tenant_id = $3",
        )
        .bind(dept_id)
        .bind(account_id)
        .bind(tenant_id)
        .execute(&mut *conn)
        .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Department assignment not found."));
        }

        Ok(())
    }

    pub async fn get_account_departments(
        &self,
        tenant_id: &str,
        account_id: &str,
    ) -> Result<Vec<DepartmentAssignmentResponse>> {
        let mut conn = self.db.get().await?;

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
