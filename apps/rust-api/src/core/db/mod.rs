//! Database connection pool — replaces PrismaService from TypeScript.
//!
//! Uses deadpool-postgres for connection pooling with SQLx for query building.
//! Mirrors the tenant-scoped transaction pattern from packages/db/src/index.ts.

use anyhow::Result;
use deadpool_postgres::{Config, Pool, Runtime, Transaction};
use sqlx::postgres::PgTransaction;

/// Database connection pool wrapper.
#[derive(Debug, Clone)]
pub struct DbPool {
    pub(crate) pool: Pool,
}

impl DbPool {
    /// Create a new DbPool from an existing Pool (for sharing).
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    /// Create a new connection pool from a PostgreSQL connection string.
    pub async fn connect(database_url: &str) -> Result<Self> {
        let mut cfg = Config::new();
        // Parse the connection string
        let url = database_url
            .strip_prefix("postgresql://")
            .or_else(|| database_url.strip_prefix("postgres://"))
            .unwrap_or(database_url);

        cfg.host = url.split(':').next().unwrap_or("localhost").to_string();
        if let Some(port_str) = url.split(':').nth(1) {
            if let Some(clean_port) = port_str.split('/').next() {
                cfg.port = clean_port.parse().unwrap_or(5432);
            }
        }
        if let Some(after_host_port) = url.splitn(2, '/').nth(1) {
            if let Some(db_name) = after_host_port.split('?').next() {
                cfg.dbname = Some(db_name.to_string());
            }
            // Extract username/password from connection string
            let before_slash = url.split('/').next().unwrap_or("");
            let after_scheme = before_slash.split(':').collect::<Vec<&str>>();
            if after_slash.len() >= 3 {
                cfg.username = Some(after_slash[0].to_string());
                cfg.password = Some(after_slash[1].to_string());
            }
        }

        let pool = cfg.create_pool(Some(Runtime::Tokio1), None)?;
        Ok(Self { pool })
    }

    /// Get the inner pool for direct access.
    pub fn inner(&self) -> &Pool {
        &self.pool
    }

    /// Run a function inside a tenant-scoped transaction.
    ///
    /// Sets `app.tenant_id` session variable for RLS policies, mirroring
    /// `withTenantContext` from packages/db/src/index.ts.
    pub async fn with_tenant<T, F, Fut>(&self, tenant_id: &str, f: F) -> Result<T>
    where
        F: FnOnce(Transaction<'_>) -> Fut,
        Fut: std::future::Future<Output = Result<T>>,
    {
        let mut tx = self.pool.begin().await?;
        // Set tenant context for RLS
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;
        f(tx).await
    }

    /// Get a connection from the pool (unscoped — for non-tenant tables).
    pub async fn get(&self) -> Result<deadpool_postgres::Object> {
        self.pool.get().await.map_err(|e| e.into())
    }
}
