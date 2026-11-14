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
use crate::modules::organization_profiles::{routes::organization_profiles_router, handlers::OrganizationProfilesState, service::OrganizationProfilesService};
use crate::modules::access::{routes::access_router, handlers::AccessState, service::AccessService};
use crate::modules::roles::{routes::roles_router, handlers::RolesState, service::RolesService};
use crate::modules::permissions::{routes::permissions_router, handlers::PermissionsState, service::PermissionsService};
use crate::modules::departments::{routes::departments_router, handlers::DepartmentsState, service::DepartmentsService};
use crate::modules::invitations::{routes::invitations_router, handlers::InvitationsState, service::InvitationsService};
use crate::modules::tenant_staff::{routes::tenant_staff_router, handlers::TenantStaffState, service::TenantStaffService};
use crate::modules::account_verification::{routes::account_verification_router, handlers::AccountVerificationState, service::AccountVerificationService};
use crate::modules::oauth::{routes::oauth_router, handlers::OAuthState, service::OAuthService};
use crate::modules::booking::{routes::booking_router, handlers::BookingState, service::BookingService};
use crate::modules::profile_content::{routes::profile_content_router, handlers::ProfileContentState, service::ProfileContentService};
use crate::modules::health::health_router;

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
    let org_profiles_state = Arc::new(OrganizationProfilesState {
        service: OrganizationProfilesService::new(state.db.clone(), state.env.clone()),
        env: state.env.clone(),
    });
    let access_state = Arc::new(AccessState {
        service: AccessService::new(state.db.clone(), state.env.clone()),
        env: state.env.clone(),
    });
    let roles_state = Arc::new(RolesState {
        service: RolesService::new(state.db.clone(), state.env.clone()),
        env: state.env.clone(),
    });
    let permissions_state = Arc::new(PermissionsState {
        service: PermissionsService::new(state.db.clone(), state.env.clone()),
        env: state.env.clone(),
    });
    let departments_state = Arc::new(DepartmentsState {
        service: DepartmentsService::new(state.db.clone(), state.env.clone()),
        env: state.env.clone(),
    });
    let invitations_state = Arc::new(InvitationsState {
        service: InvitationsService::new(state.db.clone(), state.env.clone()),
        env: state.env.clone(),
    });
    let tenant_staff_state = Arc::new(TenantStaffState {
        service: TenantStaffService::new(state.db.clone(), state.env.clone()),
        env: state.env.clone(),
    });
    let account_verification_state = Arc::new(AccountVerificationState {
        service: AccountVerificationService::new(state.db.clone(), state.env.clone()),
        env: state.env.clone(),
    });
    let oauth_state = Arc::new(OAuthState {
        service: OAuthService::new(state.db.clone(), state.env.clone()),
        env: state.env.clone(),
    });
    let booking_state = Arc::new(BookingState {
        service: BookingService::new(state.db.clone(), state.env.clone()),
        env: state.env.clone(),
    });
    let profile_content_state = Arc::new(ProfileContentState {
        service: ProfileContentService::new(state.db.clone(), state.env.clone()),
        env: state.env.clone(),
    });

    Router::new()
        .merge(health_router())
        .merge(accounts_router().with_state(accounts_state))
        .merge(tenants_router().with_state(tenants_state))
        .merge(subjects_router().with_state(subjects_state))
        .merge(verification_cases_router().with_state(verification_cases_state))
        .merge(organizations_router().with_state(organizations_state))
        .merge(sessions_router().with_state(sessions_state))
        .merge(brands_router().with_state(brands_state))
        .merge(profiles_router().with_state(profiles_state))
        .merge(organization_profiles_router().with_state(org_profiles_state))
        .merge(access_router().with_state(access_state))
        .merge(roles_router().with_state(roles_state))
        .merge(permissions_router().with_state(permissions_state))
        .merge(departments_router().with_state(departments_state))
        .merge(invitations_router().with_state(invitations_state))
        .merge(tenant_staff_router().with_state(tenant_staff_state))
        .merge(account_verification_router().with_state(account_verification_state))
        .merge(oauth_router().with_state(oauth_state))
        .merge(booking_router().with_state(booking_state))
        .merge(profile_content_router().with_state(profile_content_state))
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
