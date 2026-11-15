//! Roles service — business logic for role operations.
//!
//! Extracted from `apps/rust-api/src/modules/roles/service.rs` as part of
//! CONVENTIONS.md's crates/services split. Takes a plain `sqlx::PgPool`
//! rather than nID's `core::db::DbPool` wrapper.

use anyhow::{anyhow, Result};
use serde_json::Value;
use sqlx::{FromRow, PgPool, Row};

#[derive(Debug, Clone, FromRow)]
pub struct RoleRow {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub slug: String,
    pub permissions: Value,
    pub description: Option<String>,
    pub is_system: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone)]
pub struct RoleResponse {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub slug: String,
    pub permissions: Value,
    pub description: Option<String>,
    pub is_system: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct RoleAssignmentResponse {
    pub id: String,
    pub account_id: String,
    pub role_definition_id: String,
    pub tenant_id: String,
    pub organization_id: Option<String>,
    pub brand_id: Option<String>,
    pub scope: String,
    pub created_at: String,
}

pub struct RolesService {
    db: PgPool,
}

impl RolesService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
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

    async fn require_owner_or_partner(&self, account_id: &str, tenant_id: &str) -> Result<()> {
        let grant = sqlx::query(
            "SELECT id FROM access_grant WHERE account_id = $1 AND tenant_id = $2 AND access_type IN ('OWNER', 'PARTNER') AND status = 'ACTIVE'",
        )
        .bind(account_id)
        .bind(tenant_id)
        .fetch_optional(&self.db)
        .await?;

        if grant.is_none() {
            return Err(anyhow!("Only tenant owners or partners can perform this action."));
        }
        Ok(())
    }

    async fn require_access(&self, account_id: &str, tenant_id: &str) -> Result<()> {
        let grant = sqlx::query(
            "SELECT id FROM access_grant WHERE account_id = $1 AND tenant_id = $2 AND status = 'ACTIVE'",
        )
        .bind(account_id)
        .bind(tenant_id)
        .fetch_optional(&self.db)
        .await?;

        if grant.is_none() {
            return Err(anyhow!("You do not have access to this tenant."));
        }
        Ok(())
    }

    pub async fn create_role(
        &self,
        account_id: &str,
        tenant_id: &str,
        name: &str,
        slug: &str,
        permissions: Value,
        description: Option<&str>,
    ) -> Result<RoleResponse> {
        self.require_owner_or_partner(account_id, tenant_id).await?;

        let existing = sqlx::query("SELECT id FROM role_definition WHERE tenant_id = $1 AND slug = $2")
            .bind(tenant_id)
            .bind(slug)
            .fetch_optional(&self.db)
            .await?;
        if existing.is_some() {
            return Err(anyhow!("A role with slug \"{}\" already exists.", slug));
        }

        let role: RoleRow = sqlx::query_as(
            r#"
            INSERT INTO role_definition (id, tenant_id, name, slug, permissions, description, is_system)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false)
            RETURNING id, tenant_id, name, slug, permissions, description, is_system, created_at, updated_at
            "#,
        )
        .bind(tenant_id)
        .bind(name)
        .bind(slug)
        .bind(&permissions)
        .bind(description)
        .fetch_one(&self.db)
        .await?;

        Ok(Self::row_to_response(role))
    }

    pub async fn list_roles(&self, account_id: &str, tenant_id: &str) -> Result<Vec<RoleResponse>> {
        self.require_access(account_id, tenant_id).await?;

        let rows: Vec<RoleRow> = sqlx::query_as(
            "SELECT id, tenant_id, name, slug, permissions, description, is_system, created_at, updated_at FROM role_definition WHERE tenant_id = $1 ORDER BY is_system ASC, name ASC",
        )
        .bind(tenant_id)
        .fetch_all(&self.db)
        .await?;

        Ok(rows.into_iter().map(Self::row_to_response).collect())
    }

    pub async fn get_role(&self, account_id: &str, tenant_id: &str, role_id: &str) -> Result<RoleResponse> {
        self.require_access(account_id, tenant_id).await?;

        let role: RoleRow = sqlx::query_as(
            "SELECT id, tenant_id, name, slug, permissions, description, is_system, created_at, updated_at FROM role_definition WHERE id = $1 AND tenant_id = $2",
        )
        .bind(role_id)
        .bind(tenant_id)
        .fetch_one(&self.db)
        .await
        .map_err(|_| anyhow!("Role not found"))?;

        Ok(Self::row_to_response(role))
    }

    pub async fn update_role(
        &self,
        account_id: &str,
        tenant_id: &str,
        role_id: &str,
        name: Option<&str>,
        permissions: Option<&Value>,
        description: Option<Option<&str>>,
    ) -> Result<RoleResponse> {
        self.require_owner_or_partner(account_id, tenant_id).await?;

        let existing_role: RoleRow = sqlx::query_as(
            "SELECT id, tenant_id, name, slug, permissions, description, is_system, created_at, updated_at FROM role_definition WHERE id = $1 AND tenant_id = $2",
        )
        .bind(role_id)
        .bind(tenant_id)
        .fetch_one(&self.db)
        .await
        .map_err(|_| anyhow!("Role not found"))?;

        if existing_role.is_system {
            return Err(anyhow!("Built-in roles cannot be modified."));
        }

        let mut sets = Vec::new();
        let mut name_val: Option<String> = None;
        let mut perms_val: Option<&Value> = permissions;
        let mut desc_val: Option<Option<String>> = description.map(|d| d.map(|s| s.to_string()));

        if let Some(n) = name {
            sets.push(format!("name = ${}", sets.len() + 1));
            name_val = Some(n.to_string());
        }
        if permissions.is_some() {
            sets.push(format!("permissions = ${}", sets.len() + 1));
        }
        if description.is_some() {
            sets.push(format!("description = ${}", sets.len() + 1));
        }

        if sets.is_empty() {
            return Ok(Self::row_to_response(existing_role));
        }

        let query = format!(
            "UPDATE role_definition SET {} WHERE id = ${} AND tenant_id = ${} RETURNING id, tenant_id, name, slug, permissions, description, is_system, created_at, updated_at",
            sets.join(", "),
            sets.len() + 1,
            sets.len() + 2,
        );
        let mut q = sqlx::query_as::<_, RoleRow>(&query);
        if let Some(v) = name_val { q = q.bind(v); }
        if let Some(v) = perms_val { q = q.bind(v); }
        if desc_val.is_some() { q = q.bind(desc_val); }
        let role = q
            .bind(role_id)
            .bind(tenant_id)
            .fetch_one(&self.db)
            .await
            .map_err(|_| anyhow!("Role not found"))?;

        Ok(Self::row_to_response(role))
    }

    pub async fn delete_role(&self, account_id: &str, tenant_id: &str, role_id: &str) -> Result<()> {
        self.require_owner_or_partner(account_id, tenant_id).await?;

        let role: RoleRow = sqlx::query_as(
            "SELECT id, tenant_id, name, slug, permissions, description, is_system, created_at, updated_at FROM role_definition WHERE id = $1 AND tenant_id = $2",
        )
        .bind(role_id)
        .bind(tenant_id)
        .fetch_one(&self.db)
        .await
        .map_err(|_| anyhow!("Role not found"))?;

        if role.is_system {
            return Err(anyhow!("Built-in roles cannot be deleted."));
        }

        sqlx::query("DELETE FROM role_assignment WHERE role_definition_id = $1")
            .bind(role_id)
            .execute(&self.db)
            .await?;

        sqlx::query("DELETE FROM role_definition WHERE id = $1")
            .bind(role_id)
            .execute(&self.db)
            .await?;

        Ok(())
    }

    pub async fn assign_role(
        &self,
        account_id: &str,
        tenant_id: &str,
        role_id: &str,
        target_account_id: &str,
        organization_id: Option<&str>,
        brand_id: Option<&str>,
        scope: Option<&str>,
    ) -> Result<RoleAssignmentResponse> {
        self.require_owner_or_partner(account_id, tenant_id).await?;

        sqlx::query("SELECT id FROM role_definition WHERE id = $1 AND tenant_id = $2")
            .bind(role_id)
            .bind(tenant_id)
            .fetch_one(&self.db)
            .await
            .map_err(|_| anyhow!("Role not found"))?;

        sqlx::query("SELECT id FROM account WHERE id = $1")
            .bind(target_account_id)
            .fetch_one(&self.db)
            .await
            .map_err(|_| anyhow!("Account not found"))?;

        let scope_val = scope.unwrap_or_else(|| {
            if brand_id.is_some() { "BRAND" } else if organization_id.is_some() { "ORGANIZATION" } else { "TENANT" }
        });

        let existing = sqlx::query(
            "SELECT id FROM role_assignment WHERE account_id = $1 AND role_definition_id = $2 AND scope = $3 AND organization_id IS NOT DISTINCT FROM $4 AND brand_id IS NOT DISTINCT FROM $5",
        )
        .bind(target_account_id)
        .bind(role_id)
        .bind(scope_val)
        .bind(organization_id)
        .bind(brand_id)
        .fetch_optional(&self.db)
        .await?;
        if existing.is_some() {
            return Err(anyhow!("This account already has this role at this scope."));
        }

        let assignment: (String, String, String, String, Option<String>, Option<String>, String, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
            r#"
            INSERT INTO role_assignment (id, account_id, role_definition_id, tenant_id, organization_id, brand_id, scope)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
            RETURNING id, account_id, role_definition_id, tenant_id, organization_id, brand_id, scope, created_at
            "#,
        )
        .bind(target_account_id)
        .bind(role_id)
        .bind(tenant_id)
        .bind(organization_id)
        .bind(brand_id)
        .bind(scope_val)
        .fetch_one(&self.db)
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
        caller_account_id: &str,
        tenant_id: &str,
        role_id: &str,
        account_id: &str,
    ) -> Result<()> {
        self.require_owner_or_partner(caller_account_id, tenant_id).await?;

        sqlx::query(
            "DELETE FROM role_assignment WHERE role_definition_id = $1 AND account_id = $2 AND tenant_id = $3",
        )
        .bind(role_id)
        .bind(account_id)
        .bind(tenant_id)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    pub async fn get_account_roles(&self, caller_account_id: &str, tenant_id: &str, account_id: &str) -> Result<Vec<RoleAssignmentResponse>> {
        self.require_access(caller_account_id, tenant_id).await?;

        let rows: Vec<(String, String, String, String, Option<String>, Option<String>, String, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
            "SELECT id, account_id, role_definition_id, tenant_id, organization_id, brand_id, scope, created_at FROM role_assignment WHERE account_id = $1 AND tenant_id = $2",
        )
        .bind(account_id)
        .bind(tenant_id)
        .fetch_all(&self.db)
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
