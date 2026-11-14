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
}
