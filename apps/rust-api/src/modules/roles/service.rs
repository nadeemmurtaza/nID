//! Roles service — business logic for role operations.
//!
//! Mirrors `apps/api/src/modules/role/role.service.ts`.

use anyhow::{anyhow, Result};
use sqlx::{FromRow, Row};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::roles::dto::{
    AssignRoleRequest, RoleAssignmentResponse, RoleResponse,
};

#[derive(Debug, Clone, FromRow)]
pub struct RoleRow {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub slug: String,
    pub permissions: serde_json::Value,
    pub description: Option<String>,
    pub is_system: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub struct RolesService {
    db: DbPool,
    env: AppEnv,
}

impl RolesService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    fn row_to_response(row: RoleRow) -> RoleResponse {
        RoleResponse {
            id: row.id,
            tenant_id: row.tenant_id,
            name: row.name,
            slug: row.slug,
            permissions: row.permissions,
            description: row.description,
            is_system: row.is_system,
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
        }
    }

    pub async fn create_role(
        &self,
        tenant_id: &str,
        req: &crate::modules::roles::dto::CreateRoleRequest,
    ) -> Result<RoleResponse> {
        let mut conn = self.db.get().await?;

        let role: RoleRow = sqlx::query_as(
            r#"
            INSERT INTO role_definition (id, tenant_id, name, slug, permissions, description, is_system)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
            RETURNING id, tenant_id, name, slug, permissions, description, is_system, created_at, updated_at
            "#,
        )
        .bind(tenant_id)
        .bind(&req.name)
        .bind(&req.slug)
        .bind(&req.permissions)
        .bind(&req.description)
        .bind(req.is_system)
        .fetch_one(&mut *conn)
        .await?;

        Ok(Self::row_to_response(role))
    }

    pub async fn list_roles(&self, tenant_id: &str) -> Result<Vec<RoleResponse>> {
        let mut conn = self.db.get().await?;

        let rows: Vec<RoleRow> = sqlx::query_as(
            "SELECT id, tenant_id, name, slug, permissions, description, is_system, created_at, updated_at FROM role_definition WHERE tenant_id = $1 ORDER BY name",
        )
        .bind(tenant_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(Self::row_to_response).collect())
    }

    pub async fn get_role(&self, tenant_id: &str, role_id: &str) -> Result<RoleResponse> {
        let mut conn = self.db.get().await?;

        let role: RoleRow = sqlx::query_as(
            "SELECT id, tenant_id, name, slug, permissions, description, is_system, created_at, updated_at FROM role_definition WHERE id = $1 AND tenant_id = $2",
        )
        .bind(role_id)
        .bind(tenant_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Role not found"))?;

        Ok(Self::row_to_response(role))
    }

    pub async fn update_role(
        &self,
        tenant_id: &str,
        role_id: &str,
        req: &crate::modules::roles::dto::UpdateRoleRequest,
    ) -> Result<RoleResponse> {
        let mut conn = self.db.get().await?;

        let mut sets = Vec::new();
        let mut name_val: Option<String> = None;
        let mut perms_val: Option<&serde_json::Value> = None;
        let mut desc_val: Option<Option<String>> = None;

        if let Some(ref n) = req.name {
            sets.push("name = $1");
            name_val = Some(n.clone());
        }
        if req.permissions.is_some() {
            let idx = sets.len() + 1;
            sets.push(&format!("permissions = ${}", idx));
            perms_val = req.permissions.as_ref();
        }
        if req.description.is_some() {
            let idx = sets.len() + 1;
            sets.push(&format!("description = ${}", idx));
            desc_val = req.description;
        }

        if sets.is_empty() {
            return self.get_role(tenant_id, role_id).await;
        }

        let role: RoleRow = sqlx::query_as(
            &format!(
                "UPDATE role_definition SET {} WHERE id = ${} AND tenant_id = ${} RETURNING id, tenant_id, name, slug, permissions, description, is_system, created_at, updated_at",
                sets.join(", "),
                sets.len() + 1,
                sets.len() + 2,
            ),
        )
        .bind(&name_val)
        .bind(perms_val)
        .bind(&desc_val)
        .bind(role_id)
        .bind(tenant_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Role not found"))?;

        Ok(Self::row_to_response(role))
    }

    pub async fn delete_role(&self, tenant_id: &str, role_id: &str) -> Result<()> {
        let mut conn = self.db.get().await?;

        let result = sqlx::query(
            "DELETE FROM role_definition WHERE id = $1 AND tenant_id = $2",
        )
        .bind(role_id)
        .bind(tenant_id)
        .execute(&mut *conn)
        .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Role not found."));
        }

        Ok(())
    }

    pub async fn assign_role(
        &self,
        tenant_id: &str,
        role_id: &str,
        req: &AssignRoleRequest,
    ) -> Result<RoleAssignmentResponse> {
        let mut conn = self.db.get().await?;

        let scope = req.scope.as_deref().unwrap_or("TENANT");

        let assignment: (String, String, String, String, Option<String>, Option<String>, String, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
            r#"
            INSERT INTO role_assignment (id, account_id, role_definition_id, tenant_id, organization_id, brand_id, scope)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
            RETURNING id, account_id, role_definition_id, tenant_id, organization_id, brand_id, scope, created_at
            "#,
        )
        .bind(&req.account_id)
        .bind(role_id)
        .bind(tenant_id)
        .bind(&req.organization_id)
        .bind(&req.brand_id)
        .bind(scope)
        .fetch_one(&mut *conn)
        .await?;

        Ok(RoleAssignmentResponse {
            id: assignment.0,
            account_id: assignment.1,
            role_definition_id: assignment.2,
            tenant_id: assignment.3,
            organization_id: assignment.4,
            brand_id: assignment.5,
            scope: assignment.6,
            created_at: assignment.7.to_rfc3339(),
        })
    }

    pub async fn remove_role_assignment(
        &self,
        tenant_id: &str,
        role_id: &str,
        account_id: &str,
    ) -> Result<()> {
        let mut conn = self.db.get().await?;

        let result = sqlx::query(
            "DELETE FROM role_assignment WHERE role_definition_id = $1 AND account_id = $2 AND tenant_id = $3",
        )
        .bind(role_id)
        .bind(account_id)
        .bind(tenant_id)
        .execute(&mut *conn)
        .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Role assignment not found."));
        }

        Ok(())
    }

    pub async fn get_account_roles(&self, tenant_id: &str, account_id: &str) -> Result<Vec<RoleAssignmentResponse>> {
        let mut conn = self.db.get().await?;

        let rows: Vec<(String, String, String, String, Option<String>, Option<String>, String, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
            "SELECT id, account_id, role_definition_id, tenant_id, organization_id, brand_id, scope, created_at FROM role_assignment WHERE account_id = $1 AND tenant_id = $2",
        )
        .bind(account_id)
        .bind(tenant_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| RoleAssignmentResponse {
            id: r.0,
            account_id: r.1,
            role_definition_id: r.2,
            tenant_id: r.3,
            organization_id: r.4,
            brand_id: r.5,
            scope: r.6,
            created_at: r.7.to_rfc3339(),
        }).collect())
    }
}
