use newax_tenant_staff::{StaffMemberResponse, TenantStaffService};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.tenant_staff.v1");
}

use proto::{
    tenant_staff_service_server::{TenantStaffService as TenantStaffRpc, TenantStaffServiceServer},
    InviteRequest, ListRequest, StaffMember, StaffMemberList,
};

struct Grpc {
    service: TenantStaffService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("already") {
        Status::already_exists(msg)
    } else {
        Status::internal(msg)
    }
}

fn to_proto(s: StaffMemberResponse) -> StaffMember {
    StaffMember {
        id: s.id,
        tenant_id: s.tenant_id,
        account_id: s.account_id,
        role: s.role,
        phone: s.phone,
        phone_verified: s.phone_verified,
        created_at: s.created_at,
    }
}

#[tonic::async_trait]
impl TenantStaffRpc for Grpc {
    async fn invite(&self, req: Request<InviteRequest>) -> Result<Response<StaffMember>, Status> {
        let r = req.into_inner();
        let staff = self.service.invite(&r.tenant_id, &r.account_id, &r.role).await.map_err(to_status)?;
        Ok(Response::new(to_proto(staff)))
    }

    async fn list(&self, req: Request<ListRequest>) -> Result<Response<StaffMemberList>, Status> {
        let staff = self.service.list(&req.into_inner().tenant_id).await.map_err(to_status)?;
        Ok(Response::new(StaffMemberList { members: staff.into_iter().map(to_proto).collect() }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_tenant_staff=debug").unwrap())
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("TENANT_STAFF_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(50072);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let grpc = Grpc { service: TenantStaffService::new(pool) };

    info!(port, "svc-tenant-staff starting (gRPC)");
    Server::builder()
        .add_service(TenantStaffServiceServer::new(grpc))
        .serve(addr)
        .await?;
    Ok(())
}
