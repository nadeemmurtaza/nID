//! nID API — Rust backend replacing the TypeScript NestJS API.
//!
//! This is the entry point for the Rust migration. It uses Axum as the
//! web framework with SQLx for database access, mirroring the existing
//! NestJS + Prisma architecture in apps/api.

mod core;
mod modules;

use axum::{Router, routing};
use std::sync::Arc;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::accounts::{routes::accounts_router, handlers::AccountsState, service::AccountsService};
use crate::modules::tenants::{routes::tenants_router, handlers::TenantsState, service::TenantsService};
use crate::modules::subjects::{routes::subjects_router, handlers::SubjectsState, service::SubjectsService};
use crate::modules::verification_cases::{routes::verification_cases_router, handlers::VerificationCasesState, service::VerificationCasesService};
use crate::modules::organizations::{routes::organizations_router, handlers::OrganizationsState, service::OrganizationsService};
use crate::modules::sessions::{routes::sessions_router, handlers::SessionsState, service::SessionsService};
use crate::modules::brands::{routes::brands_router, handlers::BrandsState, service::BrandsService};
use crate::modules::profiles::{routes::profiles_router, handlers::ProfilesState, service::ProfilesService};

/// Application state shared across all request handlers.
pub struct AppState {
    pub db: DbPool,
    pub env: AppEnv,
}

/// Build the Axum router with all modules mounted.
fn build_router(state: AppState) -> Router {
    // Build per-module state
    let accounts_state = Arc::new(AccountsState {
        service: AccountsService::new(state.db.clone(), state.env.clone()),
    });
    let tenants_state = Arc::new(TenantsState {
        service: TenantsService::new(state.db.clone(), state.env.clone()),
        env: state.env.clone(),
    });
    let subjects_state = Arc::new(SubjectsState {
        service: SubjectsService::new(state.db.clone(), state.env.clone()),
    });
    let verification_cases_state = Arc::new(VerificationCasesState {
        service: VerificationCasesService::new(state.db.clone(), state.env.clone()),
    });
    let organizations_state = Arc::new(OrganizationsState {
        service: OrganizationsService::new(state.db.clone(), state.env.clone()),
    });
    let sessions_state = Arc::new(SessionsState {
        service: SessionsService::new(state.db.clone(), state.env.clone()),
    });
    let brands_state = Arc::new(BrandsState {
        service: BrandsService::new(state.db.clone(), state.env.clone()),
    });
    let profiles_state = Arc::new(ProfilesState {
        service: ProfilesService::new(state.db.clone(), state.env.clone()),
    });

    Router::new()
        .merge(accounts_router().with_state(accounts_state))
        .merge(tenants_router().with_state(tenants_state))
        .merge(subjects_router().with_state(subjects_state))
        .merge(verification_cases_router().with_state(verification_cases_state))
        .merge(organizations_router().with_state(organizations_state))
        .merge(sessions_router().with_state(sessions_state))
        .merge(brands_router().with_state(brands_state))
        .merge(profiles_router().with_state(profiles_state))
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
