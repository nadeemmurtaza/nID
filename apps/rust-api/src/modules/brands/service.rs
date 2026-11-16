//! Brands service — business logic for brand operations.
//!
//! Mirrors `apps/api/src/modules/brands/brands.service.ts`. Brand is scoped by
//! `organization_id`, not `tenant_id` — a Brand has no tenant_id column of its
//! own (see the `Brand` model in packages/db/prisma/schema.prisma); tenant
//! scoping only comes in indirectly, through Brand -> Organization -> tenantId.
//! Access control is therefore account+organization-membership based, exactly
//! like the TypeScript service, not tenant/RLS based.

use anyhow::{anyhow, Result};
use sqlx::Connection;
use sqlx::FromRow;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::brands::dto::{BrandMembershipResponse, BrandResponse, CreateBrandRequest, MessageResponse, UpdateBrandRequest};
use crate::modules::organizations::service::OrganizationsService;

#[derive(Debug, Clone, FromRow)]
pub struct BrandRow {
    pub id: String,
    pub organization_id: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub bio: Option<String>,
    pub logo_key: Option<String>,
    pub primary_color: Option<String>,
    pub secondary_color: Option<String>,
    pub website: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub social_links: Option<serde_json::Value>,
    pub products: Option<serde_json::Value>,
    pub services: Option<serde_json::Value>,
    pub prices: Option<serde_json::Value>,
    pub policies: Option<serde_json::Value>,
    pub rules: Option<serde_json::Value>,
    pub tone_guidelines: Option<serde_json::Value>,
    pub keywords: Option<serde_json::Value>,
    pub active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

const BRAND_COLUMNS: &str = "id, organization_id, name, slug, description, bio, logo_key, primary_color, secondary_color, website, email, phone, address, social_links, products, services, prices, policies, rules, tone_guidelines, keywords, active, created_at, updated_at";

pub struct BrandsService {
    db: DbPool,
    env: AppEnv,
    organizations: OrganizationsService,
}

impl BrandsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        let organizations = OrganizationsService::new(db.clone(), env.clone());
        Self { db, env, organizations }
    }

    fn row_to_response(row: BrandRow) -> BrandResponse {
        BrandResponse {
            id: row.id,
            organization_id: row.organization_id,
            name: row.name,
            slug: row.slug,
            description: row.description,
            bio: row.bio,
            logo_key: row.logo_key,
            primary_color: row.primary_color,
            secondary_color: row.secondary_color,
            website: row.website,
            email: row.email,
            phone: row.phone,
            address: row.address,
            social_links: row.social_links,
            products: row.products,
            services: row.services,
            prices: row.prices,
            policies: row.policies,
            rules: row.rules,
            tone_guidelines: row.tone_guidelines,
            keywords: row.keywords,
            active: row.active,
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
            webhook_message: None,
        }
    }

    fn slugify(name: &str) -> String {
        let lower = name.to_lowercase();
        let mut slug = String::new();
        let mut last_was_sep = false;
        for ch in lower.trim().chars() {
            if ch.is_ascii_alphanumeric() {
                slug.push(ch);
                last_was_sep = false;
            } else if (ch.is_whitespace() || ch == '_' || ch == '-') && !last_was_sep {
                slug.push('-');
                last_was_sep = true;
            }
        }
        slug.trim_matches('-').to_string()
    }

    /// Emits a webhook event to the tenant's registered webhook URL, logging it
    /// to `outbound_event`. Mirrors BrandsService.emitWebhookEvent()'s logging
    /// behavior; actual outbound HTTP delivery is handled asynchronously (no
    /// HTTP client dependency is wired into this service).
    async fn emit_webhook_event(
        &self,
        conn: &mut sqlx::PgConnection,
        tenant_id: &str,
        event_type: &str,
    ) -> Result<Option<String>> {
        let tenant: Option<(Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT webhook_url, webhook_secret_enc FROM tenant WHERE id = $1",
        )
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?;

        let Some((Some(webhook_url), Some(_secret))) = tenant else {
            return Ok(None);
        };

        // outbound_event carries forced tenant-isolation RLS; this service
        // is account/organization-scoped, not tenant-RLS-scoped, so the
        // connection it's given has no app.tenant_id set. set_config(...,
        // true) only persists for the current transaction, so this needs
        // its own short-lived nested transaction around just this insert.
        let mut nested = conn.begin().await?;
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
            .bind(tenant_id)
            .execute(&mut *nested)
            .await?;

        sqlx::query(
            r#"
            INSERT INTO outbound_event (id, tenant_id, event_type, payload, target_url, status, attempts)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, 'PENDING', 0)
            "#,
        )
        .bind(tenant_id)
        .bind(event_type)
        .bind(serde_json::json!({ "event_type": event_type, "tenant_id": tenant_id }))
        .bind(&webhook_url)
        .execute(&mut *nested)
        .await?;
        nested.commit().await?;

        Ok(Some("Webhook event emitted successfully".to_string()))
    }

    /// Create a brand under an organization. The account must be an ACTIVE admin
    /// member of the organization. Mirrors BrandsService.create().
    pub async fn create(&self, account_id: &str, req: &CreateBrandRequest) -> Result<BrandResponse> {
        let mut conn = self.db.for_account(account_id).await?;
        let tenant_id = self.organizations.require_active_admin(&req.organization_id, account_id).await?;

        let organization: Option<String> = sqlx::query_scalar("SELECT id FROM organization WHERE id = $1")
            .bind(&req.organization_id)
            .fetch_optional(&mut *conn)
            .await?;
        if organization.is_none() {
            return Err(anyhow!("Organization not found"));
        }

        let slug = req.slug.clone().unwrap_or_else(|| Self::slugify(&req.name));

        let existing: Option<String> = sqlx::query_scalar(
            "SELECT id FROM brand WHERE organization_id = $1 AND slug = $2",
        )
        .bind(&req.organization_id)
        .bind(&slug)
        .fetch_optional(&mut *conn)
        .await?;
        if existing.is_some() {
            return Err(anyhow!("A brand with slug \"{}\" already exists in this organization.", slug));
        }

        let social_links = req.social_links.as_ref().map(|m| serde_json::to_value(m).unwrap());
        let tone_guidelines = req.tone_guidelines.as_ref().map(|s| serde_json::Value::String(s.clone()));
        let keywords = req.keywords.as_ref().map(|k| serde_json::to_value(k).unwrap());

        let brand: BrandRow = sqlx::query_as(&format!(
            r#"
            INSERT INTO brand (id, organization_id, name, slug, description, bio, website, email, phone, logo_key, primary_color, secondary_color, address, social_links, products, services, prices, policies, rules, tone_guidelines, keywords)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            RETURNING {BRAND_COLUMNS}
            "#
        ))
        .bind(&req.organization_id)
        .bind(&req.name)
        .bind(&slug)
        .bind(&req.description)
        .bind(&req.bio)
        .bind(&req.website)
        .bind(&req.email)
        .bind(&req.phone)
        .bind(&req.logo_key)
        .bind(&req.primary_color)
        .bind(&req.secondary_color)
        .bind(&req.address)
        .bind(&social_links)
        .bind(&req.products)
        .bind(&req.services)
        .bind(&req.prices)
        .bind(&req.policies)
        .bind(&req.rules)
        .bind(&tone_guidelines)
        .bind(&keywords)
        .fetch_one(&mut *conn)
        .await?;

        let webhook_message = self.emit_webhook_event(&mut conn, &tenant_id, "brand.created").await?;

        let mut response = Self::row_to_response(brand);
        response.webhook_message = webhook_message;
        conn.commit().await?;
        Ok(response)
    }

    /// List all brands for a specific organization. The account must be an
    /// ACTIVE member of the organization. Mirrors BrandsService.list().
    pub async fn list(&self, account_id: &str, organization_id: &str) -> Result<Vec<BrandResponse>> {
        let mut conn = self.db.for_account(account_id).await?;
        self.organizations.require_active_member(organization_id, account_id).await?;

        let rows: Vec<BrandRow> = sqlx::query_as(&format!(
            "SELECT {BRAND_COLUMNS} FROM brand WHERE organization_id = $1 AND active = true ORDER BY created_at ASC"
        ))
        .bind(organization_id)
        .fetch_all(&mut *conn)
        .await?;

        conn.commit().await?;
        Ok(rows.into_iter().map(Self::row_to_response).collect())
    }

    /// Get a single brand by ID. The account must be an ACTIVE member of the
    /// brand's organization. Mirrors BrandsService.getById().
    pub async fn get_by_id(&self, account_id: &str, brand_id: &str) -> Result<BrandResponse> {
        let mut conn = self.db.for_account(account_id).await?;

        let brand: BrandRow = sqlx::query_as(&format!("SELECT {BRAND_COLUMNS} FROM brand WHERE id = $1"))
            .bind(brand_id)
            .fetch_one(&mut *conn)
            .await
            .map_err(|_| anyhow!("Brand not found"))?;

        self.organizations.require_active_member(&brand.organization_id, account_id).await?;

        conn.commit().await?;
        Ok(Self::row_to_response(brand))
    }

    /// Update a brand. The account must be an ACTIVE admin of the brand's
    /// organization. Mirrors BrandsService.update().
    pub async fn update(&self, account_id: &str, brand_id: &str, req: &UpdateBrandRequest) -> Result<BrandResponse> {
        let mut conn = self.db.for_account(account_id).await?;

        let existing: (String, String) = sqlx::query_as("SELECT organization_id, slug FROM brand WHERE id = $1")
            .bind(brand_id)
            .fetch_one(&mut *conn)
            .await
            .map_err(|_| anyhow!("Brand not found"))?;
        let (organization_id, current_slug) = existing;

        let tenant_id = self.organizations.require_active_admin(&organization_id, account_id).await?;

        if let Some(ref new_slug) = req.slug {
            if *new_slug != current_slug {
                let dup: Option<String> = sqlx::query_scalar(
                    "SELECT id FROM brand WHERE organization_id = $1 AND slug = $2",
                )
                .bind(&organization_id)
                .bind(new_slug)
                .fetch_optional(&mut *conn)
                .await?;
                if dup.is_some() {
                    return Err(anyhow!("A brand with slug \"{}\" already exists in this organization.", new_slug));
                }
            }
        }

        let has_update = req.name.is_some()
            || req.slug.is_some()
            || req.description.is_some()
            || req.bio.is_some()
            || req.website.is_some()
            || req.email.is_some()
            || req.phone.is_some()
            || req.logo_key.is_some()
            || req.primary_color.is_some()
            || req.secondary_color.is_some()
            || req.address.is_some()
            || req.social_links.is_some()
            || req.products.is_some()
            || req.services.is_some()
            || req.prices.is_some()
            || req.policies.is_some()
            || req.rules.is_some()
            || req.tone_guidelines.is_some()
            || req.keywords.is_some()
            || req.active.is_some();

        if !has_update {
            return self.get_by_id(account_id, brand_id).await;
        }

        let social_links = req.social_links.as_ref().map(|m| serde_json::to_value(m).unwrap());
        let tone_guidelines = req.tone_guidelines.as_ref().map(|s| serde_json::Value::String(s.clone()));
        let keywords = req.keywords.as_ref().map(|k| serde_json::to_value(k).unwrap());

        let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new("UPDATE brand SET ");
        let mut sep = qb.separated(", ");
        if let Some(ref v) = req.name { sep.push("name = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.slug { sep.push("slug = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.description { sep.push("description = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.bio { sep.push("bio = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.website { sep.push("website = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.email { sep.push("email = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.phone { sep.push("phone = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.logo_key { sep.push("logo_key = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.primary_color { sep.push("primary_color = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.secondary_color { sep.push("secondary_color = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.address { sep.push("address = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = social_links { sep.push("social_links = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.products { sep.push("products = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.services { sep.push("services = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.prices { sep.push("prices = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.policies { sep.push("policies = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = req.rules { sep.push("rules = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = tone_guidelines { sep.push("tone_guidelines = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(ref v) = keywords { sep.push("keywords = "); sep.push_bind_unseparated(v.clone()); }
        if let Some(v) = req.active { sep.push("active = "); sep.push_bind_unseparated(v); }
        qb.push(" WHERE id = ");
        qb.push_bind(brand_id.to_string());
        qb.push(&format!(" RETURNING {BRAND_COLUMNS}"));

        let brand: BrandRow = qb
            .build_query_as()
            .fetch_one(&mut *conn)
            .await
            .map_err(|_| anyhow!("Brand not found"))?;

        let webhook_message = self.emit_webhook_event(&mut conn, &tenant_id, "brand.updated").await?;

        let mut response = Self::row_to_response(brand);
        response.webhook_message = webhook_message;
        conn.commit().await?;
        Ok(response)
    }

    /// Delete (deactivate) a brand. The account must be an ACTIVE admin of the
    /// brand's organization. Mirrors BrandsService.remove().
    pub async fn remove(&self, account_id: &str, brand_id: &str) -> Result<MessageResponse> {
        let mut conn = self.db.for_account(account_id).await?;

        let organization_id: String = sqlx::query_scalar("SELECT organization_id FROM brand WHERE id = $1")
            .bind(brand_id)
            .fetch_one(&mut *conn)
            .await
            .map_err(|_| anyhow!("Brand not found"))?;

        let tenant_id = self.organizations.require_active_admin(&organization_id, account_id).await?;

        sqlx::query("UPDATE brand SET active = false WHERE id = $1")
            .bind(brand_id)
            .execute(&mut *conn)
            .await?;

        self.emit_webhook_event(&mut conn, &tenant_id, "brand.deleted").await?;

        conn.commit().await?;
        Ok(MessageResponse {
            message: "Brand deactivated successfully".to_string(),
        })
    }

    /// List all brands across all organizations the account is a member of.
    /// Mirrors BrandsService.listMyMemberships().
    pub async fn list_my_memberships(&self, account_id: &str) -> Result<Vec<BrandMembershipResponse>> {
        let mut conn = self.db.for_account(account_id).await?;

        let subject_id: Option<String> = sqlx::query_scalar("SELECT id FROM subject WHERE account_id = $1 LIMIT 1")
            .bind(account_id)
            .fetch_optional(&mut *conn)
            .await?;

        let Some(subject_id) = subject_id else {
            conn.commit().await?;
            return Ok(Vec::new());
        };

        let memberships: Vec<(String, Option<String>, bool)> = sqlx::query_as(
            "SELECT organization_id, role, is_admin FROM organization_membership WHERE person_subject_id = $1 AND status = 'ACTIVE'",
        )
        .bind(&subject_id)
        .fetch_all(&mut *conn)
        .await?;

        let mut results = Vec::new();
        for (org_id, role, is_admin) in memberships {
            let org: Option<(String, String, String)> = sqlx::query_as(
                "SELECT id, legal_name, tenant_id FROM organization WHERE id = $1",
            )
            .bind(&org_id)
            .fetch_optional(&mut *conn)
            .await?;
            let Some((organization_id, organization_name, tenant_id)) = org else { continue };

            let brands: Vec<(String, String, String)> = sqlx::query_as(
                "SELECT id, name, slug FROM brand WHERE organization_id = $1 AND active = true ORDER BY created_at ASC",
            )
            .bind(&org_id)
            .fetch_all(&mut *conn)
            .await?;

            let member_role = role.unwrap_or_else(|| if is_admin { "admin".to_string() } else { "member".to_string() });

            for (brand_id, brand_name, brand_slug) in brands {
                results.push(BrandMembershipResponse {
                    brand_id,
                    brand_name,
                    brand_slug,
                    organization_id: organization_id.clone(),
                    organization_name: organization_name.clone(),
                    tenant_id: tenant_id.clone(),
                    role: member_role.clone(),
                });
            }
        }

        conn.commit().await?;
        Ok(results)
    }
}
