//! Tenants service — business logic for tenant operations.
//!
//! Extracted from `apps/rust-api/src/modules/tenants/service.rs` as part of
//! CONVENTIONS.md's crates/services split.

use anyhow::{anyhow, Result};
use nid_shared_types::{generate_api_key, sha256_hex};
use sqlx::{FromRow, PgPool, Row};

#[derive(Debug, Clone, FromRow)]
struct TenantRow {
    id: String,
    name: String,
    slug: String,
    data_residency_region: String,
    webhook_url: Option<String>,
    billing_webhook_url: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

// --- Public response types ---

#[derive(Debug, Clone)]
pub struct TenantSelfResponse {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub data_residency_region: String,
    pub webhook_url: Option<String>,
    pub billing_webhook_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub signed_in_as: String,
}

#[derive(Debug, Clone)]
pub struct TenantResponse {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub data_residency_region: String,
    pub webhook_url: Option<String>,
    pub billing_webhook_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct TenantWithCounts {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub data_residency_region: String,
    pub webhook_url: Option<String>,
    pub billing_webhook_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub api_keys_count: i64,
    pub staff_count: i64,
    pub subjects_count: i64,
    pub cases_count: i64,
}

/// Scopes of an API key created without an explicit list: the data resources
/// a tenant integration uses, without tenant administration.
pub fn default_scopes() -> Vec<String> {
    ["subjects", "verification-cases", "organizations"]
        .iter()
        .flat_map(|r| [format!("{r}:read"), format!("{r}:write")])
        .collect()
}

#[derive(Debug, Clone)]
pub struct CreatedTenantResponse {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub data_residency_region: String,
    pub webhook_url: Option<String>,
    pub webhook_secret: String,
    pub billing_webhook_url: Option<String>,
    pub billing_webhook_secret: String,
    pub api_key: String,
    pub created_at: String,
    pub message: String,
}

#[derive(Debug, Clone)]
pub struct TenantMembership {
    pub tenant_id: String,
    pub tenant_name: String,
    pub tenant_slug: String,
    pub role: String,
}

#[derive(Debug, Clone)]
pub struct ApiKeyResponse {
    pub id: String,
    pub key_prefix: String,
    pub scopes: Vec<String>,
    pub rate_limit_per_minute: i32,
    pub revoked_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct NewApiKeyResponse {
    pub prefix: String,
    pub plaintext: String,
    pub message: String,
}

#[derive(Debug, Clone)]
pub struct StaffMemberResponse {
    pub id: String,
    pub account_id: String,
    pub role: String,
    pub phone: Option<String>,
    pub phone_verified: bool,
}

// --- Service ---

pub struct TenantsService {
    db: PgPool,
    secrets: nid_shared_types::SecretBox,
}

impl TenantsService {
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

    pub fn new(db: PgPool, secrets: nid_shared_types::SecretBox) -> Self {
        Self { db, secrets }
    }

    pub async fn get_self(&self, tenant_id: &str, actor_type: &str) -> Result<TenantSelfResponse> {
        let mut conn = self.scoped(&[("app.tenant_id", tenant_id)]).await?;
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

    pub async fn get_memberships_for_account(&self, account_id: &str) -> Result<Vec<TenantMembership>> {
        let mut conn = self.scoped(&[("app.account_id", account_id)]).await?;
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

        Ok(rows
            .into_iter()
            .map(|row| {
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
            })
            .collect())
    }

    pub async fn create(
        &self,
        name: &str,
        slug: &str,
        data_residency_region: Option<&str>,
        webhook_url: Option<&str>,
        billing_webhook_url: Option<&str>,
        initial_staff_account_id: Option<&str>,
    ) -> Result<CreatedTenantResponse> {
        let valid_slug = (3..=64).contains(&slug.len())
            && slug
                .chars()
                .next()
                .is_some_and(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
            && slug.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
        if !valid_slug {
            return Err(anyhow!(
                "Slug must be 3-64 lowercase alphanumeric characters or hyphens"
            ));
        }

        let mut conn = self.db.begin().await?;

        // The tenant row's RLS policy requires id = app.tenant_id, so the id
        // is chosen up front and set as context before the insert.
        let tenant_id = uuid::Uuid::new_v4().to_string();
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
            .bind(&tenant_id)
            .execute(&mut *conn)
            .await?;

        let webhook_secret = nid_shared_types::generate_session_token().plaintext;
        let billing_webhook_secret = nid_shared_types::generate_session_token().plaintext;

        let region = data_residency_region.unwrap_or("global");

        let tenant: TenantRow = sqlx::query_as(
            r#"
            INSERT INTO tenant (id, name, slug, data_residency_region, webhook_url, webhook_secret_enc, billing_webhook_url, billing_webhook_secret_enc)
            VALUES ($8, $1, $2, $3, $4, $5, $6, $7)
            RETURNING id, name, slug, data_residency_region, webhook_url, billing_webhook_url, created_at, updated_at
            "#,
        )
        .bind(name)
        .bind(slug)
        .bind(region)
        .bind(webhook_url)
        .bind(self.secrets.encrypt(&format!("tenant:{tenant_id}:webhook"), &webhook_secret))
        .bind(billing_webhook_url)
        .bind(self.secrets.encrypt(&format!("tenant:{tenant_id}:billing"), &billing_webhook_secret))
        .bind(&tenant_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|e| match &e {
            sqlx::Error::Database(d) if d.is_unique_violation() => {
                anyhow!("A tenant with slug '{}' already exists", slug)
            }
            _ => anyhow::Error::from(e),
        })?;

        if let Some(account_id) = initial_staff_account_id {
            let account_exists: bool =
                sqlx::query("SELECT EXISTS(SELECT 1 FROM account WHERE id = $1)")
                    .bind(account_id)
                    .fetch_one(&mut *conn)
                    .await?
                    .get(0);
            if !account_exists {
                return Err(anyhow!("Account {} not found", account_id));
            }
            sqlx::query(
                "INSERT INTO tenant_staff_membership (id, tenant_id, account_id, role) VALUES (gen_random_uuid(), $1, $2, 'ADMIN')",
            )
            .bind(&tenant.id)
            .bind(account_id)
            .execute(&mut *conn)
            .await?;
        }

        // Without a first key a new tenant has no way to authenticate: every
        // key and staff route requires an existing key.
        let key = generate_api_key("live");
        sqlx::query(
            "INSERT INTO tenant_api_key (id, tenant_id, key_prefix, key_hash, scopes, rate_limit_per_minute) VALUES (gen_random_uuid(), $1, $2, $3, $4, 60)",
        )
        .bind(&tenant.id)
        .bind(&key.prefix)
        .bind(sha256_hex(&key.plaintext))
        .bind({
            // The first key of a new tenant is its administrator: it can
            // mint further keys, which are limited to what it holds.
            let mut v = default_scopes();
            v.push("tenant-admin".to_string());
            v
        })
        .execute(&mut *conn)
        .await?;

        conn.commit().await?;

        Ok(CreatedTenantResponse {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            data_residency_region: tenant.data_residency_region,
            webhook_url: tenant.webhook_url,
            webhook_secret,
            billing_webhook_url: tenant.billing_webhook_url,
            billing_webhook_secret,
            api_key: key.plaintext,
            created_at: tenant.created_at.to_rfc3339(),
            message: "Tenant created successfully. Save the API key and webhook secrets — they cannot be recovered.".to_string(),
        })
    }

    pub async fn list_all(&self) -> Result<Vec<TenantWithCounts>> {
        let mut conn = self.scoped(&[("app.platform_admin", "true")]).await?;
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

        Ok(rows
            .into_iter()
            .map(|row| TenantWithCounts {
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
            .collect())
    }

    pub async fn get_by_id(&self, id: &str) -> Result<TenantWithCounts> {
        let mut conn = self.scoped(&[("app.platform_admin", "true")]).await?;
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

    pub async fn update(
        &self,
        id: &str,
        name: Option<&str>,
        data_residency_region: Option<&str>,
        webhook_url: Option<Option<&str>>,
        billing_webhook_url: Option<Option<&str>>,
    ) -> Result<TenantResponse> {
        let mut conn = self.scoped(&[("app.platform_admin", "true")]).await?;

        let _existing: TenantRow = sqlx::query_as(
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
        .bind(webhook_url.flatten())
        .bind(billing_webhook_url.flatten())
        .bind(id)
        .fetch_one(&mut *conn)
        .await?;

        conn.commit().await?;
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

    pub async fn create_api_key(
        &self,
        tenant_id: &str,
        scopes: Option<Vec<String>>,
        rate_limit: Option<i32>,
    ) -> Result<NewApiKeyResponse> {
        let mut conn = self.scoped(&[("app.tenant_id", tenant_id)]).await?;

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

        let scopes_vec = scopes.unwrap_or_else(default_scopes);
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

        conn.commit().await?;
        Ok(NewApiKeyResponse {
            prefix: key.prefix,
            plaintext: key.plaintext,
            message: "API key created. Save the plaintext key — it cannot be recovered.".to_string(),
        })
    }

    pub async fn list_api_keys(&self, tenant_id: &str) -> Result<Vec<ApiKeyResponse>> {
        let mut conn = self.scoped(&[("app.tenant_id", tenant_id)]).await?;
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

        Ok(rows
            .into_iter()
            .map(|row| ApiKeyResponse {
                id: row.get("id"),
                key_prefix: row.get("key_prefix"),
                scopes: row.get("scopes"),
                rate_limit_per_minute: row.get("rate_limit_per_minute"),
                revoked_at: row
                    .get::<Option<chrono::DateTime<chrono::Utc>>, _>("revoked_at")
                    .map(|dt| dt.to_rfc3339()),
                created_at: row
                    .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                    .to_rfc3339(),
            })
            .collect())
    }

    pub async fn revoke_api_key(&self, tenant_id: &str, api_key_id: &str) -> Result<()> {
        let mut conn = self.scoped(&[("app.tenant_id", tenant_id)]).await?;
        sqlx::query(
            "UPDATE tenant_api_key SET revoked_at = NOW() WHERE id = $1 AND tenant_id = $2",
        )
        .bind(api_key_id)
        .bind(tenant_id)
        .execute(&mut *conn)
        .await?;
        conn.commit().await?;
        Ok(())
    }

    pub async fn invite_staff(
        &self,
        tenant_id: &str,
        account_id: &str,
        role: &str,
    ) -> Result<StaffMemberResponse> {
        let mut conn = self.scoped(&[("app.tenant_id", tenant_id)]).await?;

        let tenant_exists: bool =
            sqlx::query("SELECT EXISTS(SELECT 1 FROM tenant WHERE id = $1)")
                .bind(tenant_id)
                .fetch_one(&mut *conn)
                .await?
                .get(0);
        if !tenant_exists {
            return Err(anyhow!("Tenant not found"));
        }

        let account_exists: bool =
            sqlx::query("SELECT EXISTS(SELECT 1 FROM account WHERE id = $1)")
                .bind(account_id)
                .fetch_one(&mut *conn)
                .await?
                .get(0);
        if !account_exists {
            return Err(anyhow!("Account not found"));
        }

        let already_staff: bool = sqlx::query(
            "SELECT EXISTS(SELECT 1 FROM tenant_staff_membership WHERE tenant_id = $1 AND account_id = $2)",
        )
        .bind(tenant_id)
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await?
        .get(0);
        if already_staff {
            return Err(anyhow!(
                "This account is already a staff member of this tenant"
            ));
        }

        let membership_id: String = sqlx::query(
            "INSERT INTO tenant_staff_membership (id, tenant_id, account_id, role) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id",
        )
        .bind(tenant_id)
        .bind(account_id)
        .bind(role)
        .fetch_one(&mut *conn)
        .await?
        .get(0);

        conn.commit().await?;
        Ok(StaffMemberResponse {
            id: membership_id,
            account_id: account_id.to_string(),
            role: role.to_string(),
            phone: None,
            phone_verified: false,
        })
    }

    pub async fn list_staff(&self, tenant_id: &str) -> Result<Vec<StaffMemberResponse>> {
        let mut conn = self.scoped(&[("app.tenant_id", tenant_id)]).await?;
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

        Ok(rows
            .into_iter()
            .map(|row| StaffMemberResponse {
                id: row.get("id"),
                account_id: row.get("account_id"),
                role: row.get("role"),
                phone: row.get("phone"),
                phone_verified: row
                    .get::<Option<chrono::DateTime<chrono::Utc>>, _>("phone_verified_at")
                    .is_some(),
            })
            .collect())
    }

    pub async fn remove_staff(&self, tenant_id: &str, account_id: &str) -> Result<()> {
        let mut conn = self.scoped(&[("app.tenant_id", tenant_id)]).await?;
        sqlx::query(
            "DELETE FROM tenant_staff_membership WHERE tenant_id = $1 AND account_id = $2",
        )
        .bind(tenant_id)
        .bind(account_id)
        .execute(&mut *conn)
        .await?;
        conn.commit().await?;
        Ok(())
    }
}
