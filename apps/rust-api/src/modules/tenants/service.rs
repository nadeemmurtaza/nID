//! Tenants service — business logic for tenant operations.
//!
//! Mirrors `apps/api/src/modules/tenants/tenants.service.ts`.

use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use deadpool_postgres::Object;
use nid_shared_types::{generate_api_key, sha256_hex};
use rand::Rng;
use sqlx::{FromRow, Row};
use tracing::info;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::tenants::dto::{
    ApiKeyResponse, CreatedTenantResponse, NewApiKeyResponse, StaffMemberResponse,
    TenantMembership, TenantResponse, TenantSelfResponse, TenantWithCounts,
};

/// Tenant row from database
#[derive(Debug, Clone, FromRow)]
pub struct TenantRow {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub data_residency_region: String,
    pub webhook_url: Option<String>,
    pub billing_webhook_url: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Tenants service
pub struct TenantsService {
    db: DbPool,
    env: AppEnv,
}

impl TenantsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    /// Get the current tenant (tenant-self endpoint)
    pub async fn get_self(&self, tenant_id: &str, actor_type: &str) -> Result<TenantSelfResponse> {
        let conn = self.db.get().await?;
        let tenant: TenantRow = sqlx::query_as(
            "SELECT id, name, slug, data_residency_region, webhook_url, billing_webhook_url, created_at, updated_at FROM tenant WHERE id = $1",
        )
        .bind(tenant_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Tenant not found"))?;

        Ok(TenantSelfResponse {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            data_residency_region: tenant.data_residency_region,
            webhook_url: tenant.webhook_url,
            billing_webhook_url: tenant.billing_webhook_url,
            created_at: tenant.created_at.to_rfc3339(),
            updated_at: tenant.updated_at.to_rfc3339(),
            signed_in_as: actor_type.to_string(),
        })
    }

    /// List all tenants this account is staff of
    pub async fn get_memberships_for_account(&self, account_id: &str) -> Result<Vec<TenantMembership>> {
        let conn = self.db.get().await?;
        let rows = sqlx::query(
            r#"
            SELECT t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug, m.role
            FROM tenant_staff_membership m
            JOIN tenant t ON m.tenant_id = t.id
            WHERE m.account_id = $1
            "#,
        )
        .bind(account_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|row| {
            let tenant_id: String = row.get("tenant_id");
            let tenant_name: String = row.get("tenant_name");
            let tenant_slug: String = row.get("tenant_slug");
            let role: String = row.get("role");
            TenantMembership {
                tenant_id,
                tenant_name,
                tenant_slug,
                role,
            }
        }).collect())
    }

    /// Create a new tenant (platform-admin)
    pub async fn create(&self, name: &str, slug: &str, data_residency_region: Option<&str>, webhook_url: Option<&str>, billing_webhook_url: Option<&str>, initial_staff_account_id: Option<&str>) -> Result<CreatedTenantResponse> {
        // Validate slug
        if !slug.is_match(r"^[a-z0-9][a-z0-9-]{2,63}$") {
            return Err(anyhow!("Slug must be 3-64 lowercase alphanumeric characters or hyphens"));
        }

        let conn = self.db.get().await?;

        // Check duplicate slug
        let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM tenant WHERE slug = $1")
            .bind(slug)
            .fetch_optional(&mut *conn)
            .await?;
        if existing.is_some() {
            return Err(anyhow!("A tenant with slug '{}' already exists", slug));
        }

        // Generate webhook secrets
        let mut rng = rand::thread_rng();
        let webhook_secret: String = (0..64).map(|_| rng.gen_range(b'0'..=b'f') as char).collect();
        let billing_webhook_secret: String = (0..64).map(|_| rng.gen_range(b'0'..=b'f') as char).collect();

        let region = data_residency_region.unwrap_or("global");

        let tenant: TenantRow = sqlx::query_as(
            r#"
            INSERT INTO tenant (id, name, slug, data_residency_region, webhook_url, webhook_secret_plaintext, billing_webhook_url, billing_webhook_secret_plaintext)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
            RETURNING id, name, slug, data_residency_region, webhook_url, billing_webhook_url, created_at, updated_at
            "#,
        )
        .bind(name)
        .bind(slug)
        .bind(region)
        .bind(webhook_url)
        .bind(&webhook_secret)
        .bind(billing_webhook_url)
        .bind(&billing_webhook_secret)
        .fetch_one(&mut *conn)
        .await?;

        // Add initial staff if provided
        if let Some(account_id) = initial_staff_account_id {
            let account_exists: bool = sqlx::query("SELECT EXISTS(SELECT 1 FROM account WHERE id = $1)")
                .bind(account_id)
                .fetch_one(&mut *conn)
                .await?
                .get(0);
            if !account_exists {
                return Err(anyhow!("Account {} not found", account_id));
            }
            sqlx::query(
                "INSERT INTO tenant_staff_membership (id, tenant_id, account_id, role) VALUES (gen_random_uuid(), $1, $2, 'ADMIN')"
            )
            .bind(&tenant.id)
            .bind(account_id)
            .execute(&mut *conn)
            .await?;
        }

        Ok(CreatedTenantResponse {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            data_residency_region: tenant.data_residency_region,
            webhook_url: tenant.webhook_url,
            webhook_secret,
            billing_webhook_url: tenant.billing_webhook_url,
            billing_webhook_secret,
            created_at: tenant.created_at.to_rfc3339(),
            message: "Tenant created successfully. Save the webhook secrets — they cannot be recovered.".to_string(),
        })
    }

    /// List all tenants (platform-admin)
    pub async fn list_all(&self) -> Result<Vec<TenantWithCounts>> {
        let conn = self.db.get().await?;
        let rows = sqlx::query(
            r#"
            SELECT t.id, t.name, t.slug, t.data_residency_region, t.webhook_url, t.billing_webhook_url,
                   t.created_at, t.updated_at,
                   (SELECT COUNT(*) FROM tenant_api_key WHERE tenant_id = t.id) as api_keys_count,
                   (SELECT COUNT(*) FROM tenant_staff_membership WHERE tenant_id = t.id) as staff_count,
                   (SELECT COUNT(*) FROM subject WHERE tenant_id = t.id) as subjects_count,
                   (SELECT COUNT(*) FROM verification_case WHERE tenant_id = t.id) as cases_count
            FROM tenant t
            ORDER BY t.created_at DESC
            "#,
        )
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|row| {
            TenantWithCounts {
                id: row.get("id"),
                name: row.get("name"),
                slug: row.get("slug"),
                data_residency_region: row.get("data_residency_region"),
                webhook_url: row.get("webhook_url"),
                billing_webhook_url: row.get("billing_webhook_url"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
                updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at").to_rfc3339(),
                api_keys_count: row.get("api_keys_count"),
                staff_count: row.get("staff_count"),
                subjects_count: row.get("subjects_count"),
                cases_count: row.get("cases_count"),
            }
        }).collect())
    }

    /// Get tenant by ID
    pub async fn get_by_id(&self, id: &str) -> Result<TenantWithCounts> {
        let conn = self.db.get().await?;
        let row = sqlx::query(
            r#"
            SELECT t.id, t.name, t.slug, t.data_residency_region, t.webhook_url, t.billing_webhook_url,
                   t.created_at, t.updated_at,
                   (SELECT COUNT(*) FROM tenant_api_key WHERE tenant_id = t.id) as api_keys_count,
                   (SELECT COUNT(*) FROM tenant_staff_membership WHERE tenant_id = t.id) as staff_count,
                   (SELECT COUNT(*) FROM subject WHERE tenant_id = t.id) as subjects_count,
                   (SELECT COUNT(*) FROM verification_case WHERE tenant_id = t.id) as cases_count
            FROM tenant t
            WHERE t.id = $1
            "#,
        )
        .bind(id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Tenant not found"))?;

        Ok(TenantWithCounts {
            id: row.get("id"),
            name: row.get("name"),
            slug: row.get("slug"),
            data_residency_region: row.get("data_residency_region"),
            webhook_url: row.get("webhook_url"),
            billing_webhook_url: row.get("billing_webhook_url"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at").to_rfc3339(),
            api_keys_count: row.get("api_keys_count"),
            staff_count: row.get("staff_count"),
            subjects_count: row.get("subjects_count"),
            cases_count: row.get("cases_count"),
        })
    }

    /// Update tenant
    pub async fn update(&self, id: &str, name: Option<&str>, data_residency_region: Option<&str>, webhook_url: Option<Option<&str>>, billing_webhook_url: Option<Option<&str>>) -> Result<TenantResponse> {
        let conn = self.db.get().await?;

        // Check tenant exists
        let existing: TenantRow = sqlx::query_as(
            "SELECT id, name, slug, data_residency_region, webhook_url, billing_webhook_url, created_at, updated_at FROM tenant WHERE id = $1",
        )
        .bind(id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Tenant not found"))?;

        let tenant: TenantRow = sqlx::query_as(
            r#"
            UPDATE tenant SET
                name = COALESCE($1, name),
                data_residency_region = COALESCE($2, data_residency_region),
                webhook_url = CASE WHEN $3::text IS NULL THEN webhook_url ELSE $3 END,
                billing_webhook_url = CASE WHEN $4::text IS NULL THEN billing_webhook_url ELSE $4 END
            WHERE id = $5
            RETURNING id, name, slug, data_residency_region, webhook_url, billing_webhook_url, created_at, updated_at
            "#,
        )
        .bind(name)
        .bind(data_residency_region)
        .bind(webhook_url)
        .bind(billing_webhook_url)
        .bind(id)
        .fetch_one(&mut *conn)
        .await?;

        Ok(TenantResponse {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            data_residency_region: tenant.data_residency_region,
            webhook_url: tenant.webhook_url,
            billing_webhook_url: tenant.billing_webhook_url,
            created_at: tenant.created_at.to_rfc3339(),
            updated_at: tenant.updated_at.to_rfc3339(),
        })
    }

    /// Create an API key for a tenant
    pub async fn create_api_key(&self, tenant_id: &str, scopes: Option<Vec<String>>, rate_limit: Option<i32>) -> Result<NewApiKeyResponse> {
        let conn = self.db.get().await?;

        // Check tenant exists
        let exists: bool = sqlx::query("SELECT EXISTS(SELECT 1 FROM tenant WHERE id = $1)")
            .bind(tenant_id)
            .fetch_one(&mut *conn)
            .await?
            .get(0);
        if !exists {
            return Err(anyhow!("Tenant not found"));
        }

        let key = generate_api_key("live");
        let key_hash = sha256_hex(&key.plaintext);

        let scopes_vec = scopes.unwrap_or_else(|| vec!["verification-cases:read".to_string(), "verification-cases:write".to_string()]);
        let rate_limit_val = rate_limit.unwrap_or(60);

        sqlx::query(
            r#"
            INSERT INTO tenant_api_key (id, tenant_id, key_prefix, key_hash, scopes, rate_limit_per_minute)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
            "#,
        )
        .bind(tenant_id)
        .bind(&key.prefix)
        .bind(&key_hash)
        .bind(&scopes_vec)
        .bind(rate_limit_val)
        .execute(&mut *conn)
        .await?;

        Ok(NewApiKeyResponse {
            prefix: key.prefix,
            plaintext: key.plaintext,
            message: "API key created. Save the plaintext key — it cannot be recovered.".to_string(),
        })
    }

    /// List API keys for a tenant
    pub async fn list_api_keys(&self, tenant_id: &str) -> Result<Vec<ApiKeyResponse>> {
        let conn = self.db.get().await?;
        let rows = sqlx::query(
            r#"
            SELECT id, key_prefix, scopes, rate_limit_per_minute, revoked_at, created_at
            FROM tenant_api_key
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|row| {
            ApiKeyResponse {
                id: row.get("id"),
                key_prefix: row.get("key_prefix"),
                scopes: row.get("scopes"),
                rate_limit_per_minute: row.get("rate_limit_per_minute"),
                revoked_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("revoked_at").map(|dt| dt.to_rfc3339()),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            }
        }).collect())
    }

    /// Revoke an API key
    pub async fn revoke_api_key(&self, tenant_id: &str, api_key_id: &str) -> Result<()> {
        let conn = self.db.get().await?;
        sqlx::query("UPDATE tenant_api_key SET revoked_at = NOW() WHERE id = $1 AND tenant_id = $2")
            .bind(api_key_id)
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;
        Ok(())
    }

    /// Invite a staff member to a tenant
    pub async fn invite_staff(&self, tenant_id: &str, account_id: &str, role: &str) -> Result<StaffMemberResponse> {
        let conn = self.db.get().await?;

        // Check tenant exists
        let tenant_exists: bool = sqlx::query("SELECT EXISTS(SELECT 1 FROM tenant WHERE id = $1)")
            .bind(tenant_id)
            .fetch_one(&mut *conn)
            .await?
            .get(0);
        if !tenant_exists {
            return Err(anyhow!("Tenant not found"));
        }

        // Check account exists
        let account_exists: bool = sqlx::query("SELECT EXISTS(SELECT 1 FROM account WHERE id = $1)")
            .bind(account_id)
            .fetch_one(&mut *conn)
            .await?
            .get(0);
        if !account_exists {
            return Err(anyhow!("Account not found"));
        }

        // Check not already staff
        let already_staff: bool = sqlx::query(
            "SELECT EXISTS(SELECT 1 FROM tenant_staff_membership WHERE tenant_id = $1 AND account_id = $2)"
        )
        .bind(tenant_id)
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await?
        .get(0);
        if already_staff {
            return Err(anyhow!("This account is already a staff member of this tenant"));
        }

        let membership_id: String = sqlx::query(
            "INSERT INTO tenant_staff_membership (id, tenant_id, account_id, role) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id"
        )
        .bind(tenant_id)
        .bind(account_id)
        .bind(role)
        .fetch_one(&mut *conn)
        .await?
        .get(0);

        Ok(StaffMemberResponse {
            id: membership_id,
            account_id: account_id.to_string(),
            role: role.to_string(),
            phone: None,
            phone_verified: false,
        })
    }

    /// List staff members of a tenant
    pub async fn list_staff(&self, tenant_id: &str) -> Result<Vec<StaffMemberResponse>> {
        let conn = self.db.get().await?;
        let rows = sqlx::query(
            r#"
            SELECT m.id, m.account_id, m.role, a.phone, a.phone_verified_at
            FROM tenant_staff_membership m
            LEFT JOIN account a ON m.account_id = a.id
            WHERE m.tenant_id = $1
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|row| {
            StaffMemberResponse {
                id: row.get("id"),
                account_id: row.get("account_id"),
                role: row.get("role"),
                phone: row.get("phone"),
                phone_verified: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("phone_verified_at").is_some(),
            }
        }).collect())
    }

    /// Remove a staff member from a tenant
    pub async fn remove_staff(&self, tenant_id: &str, account_id: &str) -> Result<()> {
        let conn = self.db.get().await?;
        sqlx::query("DELETE FROM tenant_staff_membership WHERE tenant_id = $1 AND account_id = $2")
            .bind(tenant_id)
            .bind(account_id)
            .execute(&mut *conn)
            .await?;
        Ok(())
    }
}
