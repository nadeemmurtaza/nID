use newax_permissions::{PermissionCatalogEntry, PermissionGroup, PermissionsService};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.permissions.v1");
}

use proto::{
    permissions_service_server::{PermissionsService as PermissionsRpc, PermissionsServiceServer},
    Empty, GroupRequest, PermissionCatalogEntry as ProtoEntry, PermissionEntryList, PermissionGroup as ProtoGroup,
    PermissionGroupList,
};

struct PermissionsGrpc {
    service: PermissionsService,
}

fn to_status(e: anyhow::Error) -> Status {
    Status::internal(e.to_string())
}

fn entry_to_proto(e: PermissionCatalogEntry) -> ProtoEntry {
    ProtoEntry {
        id: e.id,
        group_name: e.group_name,
        service_name: e.service_name,
        permission_key: e.permission_key,
        label: e.label,
        description: e.description,
    }
}

fn group_to_proto(g: PermissionGroup) -> ProtoGroup {
    ProtoGroup {
        group_name: g.group_name,
        permissions: g.permissions.into_iter().map(entry_to_proto).collect(),
    }
}

#[tonic::async_trait]
impl PermissionsRpc for PermissionsGrpc {
    async fn get_catalog(&self, _req: Request<Empty>) -> Result<Response<PermissionGroupList>, Status> {
        let groups = self.service.get_catalog().await.map_err(to_status)?;
        Ok(Response::new(PermissionGroupList {
            groups: groups.into_iter().map(group_to_proto).collect(),
        }))
    }

    async fn get_all(&self, _req: Request<Empty>) -> Result<Response<PermissionEntryList>, Status> {
        let entries = self.service.get_all_permissions().await.map_err(to_status)?;
        Ok(Response::new(PermissionEntryList {
            entries: entries.into_iter().map(entry_to_proto).collect(),
        }))
    }

    async fn get_group(&self, req: Request<GroupRequest>) -> Result<Response<PermissionEntryList>, Status> {
        let entries = self
            .service
            .get_group_permissions(&req.into_inner().group_name)
            .await
            .map_err(to_status)?;
        Ok(Response::new(PermissionEntryList {
            entries: entries.into_iter().map(entry_to_proto).collect(),
        }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_permissions=debug").unwrap())
        .init();

    let database_url = std::env::var("APP_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .map_err(|_| "APP_DATABASE_URL (or DATABASE_URL) must be set")?;
    let pool = PgPoolOptions::new().max_connections(5).connect(&database_url).await?;

    let port: u16 = std::env::var("PERMISSIONS_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(50071);
    let addr = format!("0.0.0.0:{port}").parse()?;

    let grpc = PermissionsGrpc { service: PermissionsService::new(pool) };

    info!(port, "svc-permissions starting (gRPC)");
    Server::builder()
        .add_service(PermissionsServiceServer::new(grpc))
        .serve(addr)
        .await?;
    Ok(())
}
