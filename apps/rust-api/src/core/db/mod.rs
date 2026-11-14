//! Database connection pool — replaces PrismaService from TypeScript.
//!
//! Uses SQLx's own connection pool throughout. Mirrors the tenant-scoped
//! transaction pattern from packages/db/src/index.ts.

use anyhow::Result;
use sqlx::postgres::{PgPoolOptions, PgPool};
use sqlx::pool::PoolConnection;
use sqlx::{Postgres, Transaction};

/// Database connection pool wrapper.
#[derive(Debug, Clone)]
pub struct DbPool {
    pub(crate) pool: PgPool,
}

impl DbPool {
    /// Create a new DbPool from an existing Pool (for sharing).
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Create a new connection pool from a PostgreSQL connection string.
    pub async fn connect(database_url: &str) -> Result<Self> {
        let pool = PgPoolOptions::new().connect(database_url).await?;
        Ok(Self { pool })
    }

    /// Get the inner pool for direct access.
    pub fn inner(&self) -> &PgPool {
        &self.pool
    }

    /// Run a function inside a tenant-scoped transaction.
    ///
    /// Sets `app.tenant_id` session variable for RLS policies, mirroring
    /// `withTenantContext` from packages/db/src/index.ts.
    pub async fn with_tenant<T, F, Fut>(&self, tenant_id: &str, f: F) -> Result<T>
    where
        F: FnOnce(Transaction<'_, Postgres>) -> Fut,
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
    pub async fn get(&self) -> Result<PoolConnection<Postgres>> {
        self.pool.acquire().await.map_err(|e| e.into())
    }
}
