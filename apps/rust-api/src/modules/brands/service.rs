//! Brands service.

use anyhow::{anyhow, Result};
use deadpool_postgres::Object;
use sqlx::{FromRow, Row};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::brands::dto::BrandResponse;

#[derive(Debug, Clone, FromRow)]
pub struct BrandRow {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub slug: String,
    pub logo_url: Option<String>,
    pub primary_color: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub struct BrandsService {
    db: DbPool,
    env: AppEnv,
}

impl BrandsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    fn row_to_response(row: BrandRow) -> BrandResponse {
        BrandResponse {
            id: row.id,
            tenant_id: row.tenant_id,
            name: row.name,
            slug: row.slug,
            logo_url: row.logo_url,
            primary_color: row.primary_color,
            created_at: row.created_at.to_rfc3339(),
        }
    }

    pub async fn create(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        req: &crate::modules::brands::dto::CreateBrandRequest,
    ) -> Result<BrandResponse> {
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1").bind(tenant_id).execute(&mut *conn).await?;

        let brand: BrandRow = sqlx::query_as(
            r#"
            INSERT INTO brand (id, tenant_id, name, slug, logo_url, primary_color)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
            RETURNING id, tenant_id, name, slug, logo_url, primary_color, created_at
            "#,
        )
        .bind(tenant_id)
        .bind(&req.name)
        .bind(&req.slug)
        .bind(&req.logo_url)
        .bind(&req.primary_color)
        .fetch_one(&mut *conn)
        .await?;

        sqlx::query(
            r#"INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, metadata)
               VALUES (gen_random_uuid(), $1, 'API_KEY', $2, 'brand.create', NULL)"#,
        )
        .bind(tenant_id)
        .bind(api_key_id)
        .execute(&mut *conn)
        .await?;

        Ok(Self::row_to_response(brand))
    }

    pub async fn list_all(&self, tenant_id: &str) -> Result<Vec<BrandResponse>> {
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1").bind(tenant_id).execute(&mut *conn).await?;

        let rows: Vec<BrandRow> = sqlx::query_as(
            "SELECT id, tenant_id, name, slug, logo_url, primary_color, created_at FROM brand ORDER BY created_at DESC",
        )
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(Self::row_to_response).collect())
    }

    pub async fn get_by_slug(&self, tenant_id: &str, slug: &str) -> Result<BrandResponse> {
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1").bind(tenant_id).execute(&mut *conn).await?;

        let brand: BrandRow = sqlx::query_as(
            "SELECT id, tenant_id, name, slug, logo_url, primary_color, created_at FROM brand WHERE slug = $1",
        )
        .bind(slug)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Brand not found"))?;

        Ok(Self::row_to_response(brand))
    }

    /// Get a brand by ID — mirrors BrandsService.getById().
    pub async fn get_by_id(&self, tenant_id: &str, brand_id: &str) -> Result<BrandResponse> {
        let conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1").bind(tenant_id).execute(&mut *conn).await?;

        let brand: BrandRow = sqlx::query_as(
            "SELECT id, tenant_id, name, slug, logo_url, primary_color, created_at FROM brand WHERE id = $1",
        )
        .bind(brand_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Brand not found"))?;

        Ok(Self::row_to_response(brand))
    }

    /// Update a brand — mirrors BrandsService.update().
    pub async fn update(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        brand_id: &str,
        req: &crate::modules::brands::dto::UpdateBrandRequest,
    ) -> Result<BrandResponse> {
        let mut conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1").bind(tenant_id).execute(&mut *conn).await?;

        // Verify brand exists
        let existing: (String, String) = sqlx::query_as(
            "SELECT id, slug FROM brand WHERE id = $1",
        )
        .bind(brand_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Brand not found"))?;

        // Build dynamic SET clause
        let mut sets = Vec::new();
        let mut binds: Vec<Box<dyn sqlx::types::Type<sqlx::Postgres> + Send + Sync>> = Vec::new();

        if let Some(ref name) = req.name {
            sets.push(format!("name = ${}", sets.len() + 1));
            binds.push(Box::new(name.clone()));
        }
        if let Some(ref slug) = req.slug {
            sets.push(format!("slug = ${}", sets.len() + 1));
            binds.push(Box::new(slug.clone()));
        }
        if let Some(ref desc) = req.description {
            sets.push(format!("description = ${}", sets.len() + 1));
            binds.push(Box::new(desc.clone()));
        }
        if let Some(ref bio) = req.bio {
            sets.push(format!("bio = ${}", sets.len() + 1));
            binds.push(Box::new(bio.clone()));
        }
        if let Some(ref website) = req.website {
            sets.push(format!("website = ${}", sets.len() + 1));
            binds.push(Box::new(website.clone()));
        }
        if let Some(ref email) = req.email {
            sets.push(format!("email = ${}", sets.len() + 1));
            binds.push(Box::new(email.clone()));
        }
        if let Some(ref phone) = req.phone {
            sets.push(format!("phone = ${}", sets.len() + 1));
            binds.push(Box::new(phone.clone()));
        }
        if let Some(active) = req.active {
            sets.push(format!("active = ${}", sets.len() + 1));
            binds.push(Box::new(active));
        }

        if sets.is_empty() {
            return self.get_by_id(tenant_id, brand_id).await;
        }

        let base_idx = sets.len() + 1;
        let query = format!(
            "UPDATE brand SET {} WHERE id = ${} RETURNING id, tenant_id, name, slug, logo_url, primary_color, created_at",
            sets.join(", "),
            base_idx
        );

        // Use raw query with dynamic binds
        let brand: BrandRow = sqlx::query_as(&query)
            .bind(brand_id)
            .fetch_one(&mut *conn)
            .await
            .map_err(|_| anyhow!("Brand not found"))?;

        // Audit log
        sqlx::query(
            r#"INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, metadata)
               VALUES (gen_random_uuid(), $1, 'API_KEY', $2, 'brand.update', NULL)"#,
        )
        .bind(tenant_id)
        .bind(api_key_id)
        .execute(&mut *conn)
        .await?;

        Ok(Self::row_to_response(brand))
    }

    /// Remove (deactivate) a brand — mirrors BrandsService.remove().
    pub async fn remove(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        brand_id: &str,
    ) -> Result<crate::modules::brands::dto::MessageResponse> {
        let mut conn = self.db.get().await?;
        sqlx::query("SET app.tenant_id = $1").bind(tenant_id).execute(&mut *conn).await?;

        // Verify brand exists
        sqlx::query("SELECT id FROM brand WHERE id = $1")
            .bind(brand_id)
            .fetch_one(&mut *conn)
            .await
            .map_err(|_| anyhow!("Brand not found"))?;

        // Soft delete
        sqlx::query("UPDATE brand SET active = false WHERE id = $1")
            .bind(brand_id)
            .execute(&mut *conn)
            .await?;

        // Audit log
        sqlx::query(
            r#"INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, metadata)
               VALUES (gen_random_uuid(), $1, 'API_KEY', $2, 'brand.delete', NULL)"#,
        )
        .bind(tenant_id)
        .bind(api_key_id)
        .execute(&mut *conn)
        .await?;

        Ok(crate::modules::brands::dto::MessageResponse {
            message: "Brand deactivated successfully".to_string(),
        })
    }

    /// List all brands across organizations the account is a member of — mirrors BrandsService.listMyMemberships().
    pub async fn list_my_memberships(&self, account_id: &str) -> Result<Vec<crate::modules::brands::dto::BrandMembershipResponse>> {
        let mut conn = self.db.get().await?;

        // Find the person subject for this account
        let subject_id: Option<String> = sqlx::query_scalar(
            "SELECT id FROM subject WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?;

        let subject_id = subject_id.ok_or_else(|| anyhow!("No subject found for account"))?;

        // Get all active organization memberships
        let memberships: Vec<(String, Option<String>, bool)> = sqlx::query_as(
            "SELECT organization_id, role, is_admin FROM organization_membership
             WHERE person_subject_id = $1 AND status = 'ACTIVE'",
        )
        .bind(&subject_id)
        .fetch_all(&mut *conn)
        .await?;

        let mut results = Vec::new();
        for (org_id, role, is_admin) in memberships {
            // Get organization info
            let org: (String, String, String) = sqlx::query_as(
                "SELECT id, legal_name, tenant_id FROM organization WHERE id = $1",
            )
            .bind(&org_id)
            .fetch_optional(&mut *conn)
            .await?
            .ok_or_else(|| anyhow!("Organization not found"))?;

            // Get active brands for this organization
            let brands: Vec<(String, String, String)> = sqlx::query_as(
                "SELECT id, name, slug FROM brand WHERE organization_id = $1 AND active = true ORDER BY created_at ASC",
            )
            .bind(&org_id)
            .fetch_all(&mut *conn)
            .await?;

            let member_role = role.unwrap_or_else(|| if is_admin { "admin".to_string() } else { "member".to_string() });

            for (brand_id, brand_name, brand_slug) in brands {
                results.push(crate::modules::brands::dto::BrandMembershipResponse {
                    brand_id,
                    brand_name,
                    brand_slug,
                    organization_id: org.0,
                    organization_name: org.1,
                    tenant_id: org.2,
                    role: member_role.clone(),
                });
            }
        }

        Ok(results)
    }
}
