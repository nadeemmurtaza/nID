//! nID API — Rust backend replacing the TypeScript NestJS API.
//!
//! This is the entry point for the Rust migration. It uses Axum as the
//! web framework with SQLx for database access, mirroring the existing
//! NestJS + Prisma architecture in apps/api.

mod core;
mod modules;

use axum::{Router, routing};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::accounts::routes::accounts_router;

/// Application state shared across all request handlers.
pub struct AppState {
    pub db: DbPool,
    pub env: AppEnv,
}

/// Build the Axum router with all modules mounted.
fn build_router(state: AppState) -> Router {
    Router::new()
        .merge(accounts_router())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Bootstrap the API server.
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment
    dotenvy::dotenv().ok();
    let env = AppEnv::load()?;

    // Connect to database
    let db = DbPool::connect(&env.app_database_url).await?;

    tracing::info!(port = env.api_port, "nID Rust API starting");

    // Build and run server
    let state = AppState { db, env };
    let app = build_router(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", env.api_port)).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
