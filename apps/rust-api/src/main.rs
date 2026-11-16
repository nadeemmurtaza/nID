//! nID API — Rust backend replacing the TypeScript NestJS API.
//!
//! This is the entry point for the Rust migration. It uses Axum as the
//! web framework with SQLx for database access, mirroring the existing
//! NestJS + Prisma architecture in apps/api.

mod core;
mod modules;

use anyhow::Context;
use axum::http::{HeaderName, HeaderValue, Method};
use axum::{Router, middleware, Extension};
use std::sync::Arc;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::core::middleware::request_tracing;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::core::audit::AuditService;
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
    pub audit: AuditService,
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
        service: ProfileContentService,
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
        .layer(Extension(state.db.clone()))
        .layer(Extension(state.env.clone()))
        .layer(middleware::from_fn(request_tracing))
        .layer(build_cors_layer(&state.env))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("x-frame-options"),
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("same-origin"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("strict-transport-security"),
            HeaderValue::from_static("max-age=63072000; includeSubDomains"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("content-security-policy"),
            HeaderValue::from_static("default-src 'none'; frame-ancestors 'none'"),
        ))
        .layer({
            // Per-IP rate limit (SECURITY_RULES.md item 5 /
            // PRODUCTION_READINESS_RULES.md item 7): 10 req/s sustained,
            // bursts up to 30. Per-user limits on top of this would need a
            // custom key extractor keyed on the auth token rather than the
            // peer IP; not yet implemented -- this covers the per-IP half.
            let config = std::sync::Arc::new(
                GovernorConfigBuilder::default()
                    // The builder takes the replenish *interval*, not a rate:
                    // per_second(10) would mean one request per 10 seconds.
                    .per_millisecond(100)
                    .burst_size(30)
                    .finish()
                    .expect("valid governor rate-limit config"),
            );
            GovernorLayer::new(config)
        })
        .layer(TraceLayer::new_for_http())
}

/// Explicit CORS allowlist (SECURITY_RULES.md item 8) -- never
/// `CorsLayer::permissive()`. Origins come from `ALLOWED_ORIGINS`
/// (see `AppEnv::load`), never a wildcard.
fn build_cors_layer(env: &AppEnv) -> CorsLayer {
    let origins: Vec<HeaderValue> = env
        .allowed_origins
        .iter()
        .filter_map(|o| HeaderValue::from_str(o).ok())
        .collect();

    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
            axum::http::header::ACCEPT,
            // core/auth/tenant_actor.rs tells multi-tenant staff to send this.
            HeaderName::from_static("x-tenant-id"),
        ])
        .allow_credentials(true)
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

    // Apply schema migrations (crates/db-schema) before accepting traffic.
    // Runs as the DDL-owning role (DATABASE_URL), never APP_DATABASE_URL --
    // nid_app has no BYPASSRLS and isn't meant to own schema. Prisma's
    // migrations already built this schema historically; db-schema's
    // baseline migration is a snapshot of it, so this is a tool cutover,
    // not a schema change (see crates/db-schema/src/lib.rs).
    let migrate_db_url = std::env::var("DATABASE_URL")
        .context("DATABASE_URL (migration-capable role) must be set to apply schema migrations")?;
    let migrate_pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(1)
        .connect(&migrate_db_url)
        .await?;
    // Any webhook secret still stored as plaintext is encrypted first: the
    // migration that drops the plaintext columns refuses to run otherwise.
    // Only needs the key when there is something to encrypt.
    let encrypt_legacy = async {
        let legacy_present: bool = sqlx::query_scalar(
            r#"SELECT EXISTS (SELECT 1 FROM information_schema.columns
                              WHERE table_schema = 'public' AND table_name = 'Tenant'
                                AND column_name = 'webhookSecretPlaintext')"#,
        )
        .fetch_one(&migrate_pool)
        .await?;
        if legacy_present {
            let secrets = nid_shared_types::SecretBox::from_env()
                .context("WEBHOOK_SECRET_KEY is required to encrypt existing tenant webhook secrets")?;
            let n = nid_db_schema::encrypt_legacy_webhook_secrets(&migrate_pool, &secrets).await?;
            tracing::info!(tenants = n, "Encrypted legacy plaintext webhook secrets");
        }
        anyhow::Ok(())
    };
    encrypt_legacy.await?;
    nid_db_schema::MIGRATOR.run(&migrate_pool).await?;
    migrate_pool.close().await;

    // Connect to database
    let db = DbPool::connect(&env.app_database_url).await?;

    tracing::info!(port = env.api_port, "nID Rust API starting");

    // Build shared services
    let audit = AuditService::new(db.clone());
    let api_port = env.api_port;

    // Build and run server
    let state = AppState { db, env, audit };
    let app = build_router(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", api_port)).await?;
    let addr = listener.local_addr()?;
    tracing::info!(%addr, "Listening for connections");

    // GovernorLayer's PeerIpKeyExtractor reads ConnectInfo<SocketAddr> from
    // request extensions -- without into_make_service_with_connect_info,
    // that extension is never populated and every request 500s with
    // "UnableToExtractKey".
    let make_service = app.into_make_service_with_connect_info::<std::net::SocketAddr>();

    // Graceful shutdown on SIGINT/SIGTERM
    let graceful = async {
        axum::serve(listener, make_service)
            .with_graceful_shutdown(shutdown_signal())
            .await
    };

    graceful.await?;
    tracing::info!("nID Rust API shutting down");

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }
}
