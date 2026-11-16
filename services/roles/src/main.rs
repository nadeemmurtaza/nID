use newax_roles::{RoleAssignmentResponse, RoleResponse, RolesService};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.roles.v1");
}

use proto::{
    roles_api_service_server::{RolesApiService as RolesRpc, RolesApiServiceServer},
    AssignRoleRpcRequest, DeleteRoleRequest, Empty, GetAccountRolesRequest,
    GetRoleRequest, ListRolesRequest, RemoveRoleAssignmentRequest,
    RoleAssignmentListResponse, RoleAssignmentResponse as ProtoAssignment,
    RoleListResponse, RoleResponse as ProtoRole,
    CreateRoleRequest as ProtoCreateRole, UpdateRoleRequest as ProtoUpdateRole,
};

struct RolesGrpc {
    service: RolesService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") {
        Status::not_found(msg)
    } else if msg.contains("access") || msg.contains("owners") || msg.contains("partners") {
        Status::permission_denied(msg)
    } else if msg.contains("already") {
        Status::already_exists(msg)
    } else {
        Status::internal(msg)
    }
}

fn role_to_proto(r: RoleResponse) -> ProtoRole {
    ProtoRole {
        id: r.id,
        tenant_id: r.tenant_id,
        name: r.name,
        slug: r.slug,
        permissions_json: serde_json::to_string(&r.permissions).unwrap_or_default(),
        description: r.description,
        is_system: r.is_system,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }
}

fn assignment_to_proto(a: RoleAssignmentResponse) -> ProtoAssignment {
    ProtoAssignment {
        id: a.id,
        account_id: a.account_id,
        role_definition_id: a.role_definition_id,
        tenant_id: a.tenant_id,
        organization_id: a.organization_id,
        brand_id: a.brand_id,
        scope: a.scope,
        created_at: a.created_at,
    }
}

#[tonic::async_trait]
impl RolesRpc for RolesGrpc {
    async fn create_role(&self, req: Request<ProtoCreateRole>) -> Result<Response<ProtoRole>, Status> {
        let r = req.into_inner();
        let permissions: Value = serde_json::from_str(&r.permissions_json).map_err(|e| Status::invalid_argument(e.to_string()))?;
        let result = self.service.create_role(&r.account_id, &r.tenant_id, &r.name, &r.slug, permissions, r.description.as_deref()).await.map_err(to_status)?;
        Ok(Response::new(role_to_proto(result)))
    }

    async fn list_roles(&self, req: Request<ListRolesRequest>) -> Result<Response<RoleListResponse>, Status> {
        let r = req.into_inner();
        let roles = self.service.list_roles(&r.account_id, &r.tenant_id).await.map_err(to_status)?;
        Ok(Response::new(RoleListResponse {
            roles: roles.into_iter().map(role_to_proto).collect(),
        }))
    }

    async fn get_role(&self, req: Request<GetRoleRequest>) -> Result<Response<ProtoRole>, Status> {
        let r = req.into_inner();
        let result = self.service.get_role(&r.account_id, &r.tenant_id, &r.role_id).await.map_err(to_status)?;
        Ok(Response::new(role_to_proto(result)))
    }

    async fn update_role(&self, req: Request<ProtoUpdateRole>) -> Result<Response<ProtoRole>, Status> {
        let r = req.into_inner();
        let permissions: Option<Value> = r.permissions_json.as_deref().and_then(|s| serde_json::from_str(s).ok());
        let result = self.service.update_role(&r.account_id, &r.tenant_id, &r.role_id, r.name.as_deref(), permissions.as_ref(), r.description.as_ref().map(|s| Some(s.as_str()))).await.map_err(to_status)?;
        Ok(Response::new(role_to_proto(result)))
    }

    async fn delete_role(&self, req: Request<DeleteRoleRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service.delete_role(&r.account_id, &r.tenant_id, &r.role_id).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn assign_role(&self, req: Request<AssignRoleRpcRequest>) -> Result<Response<ProtoAssignment>, Status> {
        let r = req.into_inner();
        let result = self.service.assign_role(&r.account_id, &r.tenant_id, &r.role_id, &r.target_account_id, r.organization_id.as_deref(), r.brand_id.as_deref(), r.scope.as_deref()).await.map_err(to_status)?;
        Ok(Response::new(assignment_to_proto(result)))
    }

    async fn remove_role_assignment(&self, req: Request<RemoveRoleAssignmentRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service.remove_role_assignment(&r.caller_account_id, &r.tenant_id, &r.role_id, &r.account_id).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn get_account_roles(&self, req: Request<GetAccountRolesRequest>) -> Result<Response<RoleAssignmentListResponse>, Status> {
        let r = req.into_inner();
        let assignments = self.service.get_account_roles(&r.caller_account_id, &r.tenant_id, &r.account_id).await.map_err(to_status)?;
        Ok(Response::new(RoleAssignmentListResponse {
            assignments: assignments.into_iter().map(assignment_to_proto).collect(),
        }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_roles=debug").unwrap())
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("ROLES_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(50082);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let grpc = RolesGrpc { service: RolesService::new(pool) };

    info!(port, "svc-roles starting (gRPC)");
    nid_service_auth::server_builder()?
        .add_service(RolesApiServiceServer::with_interceptor(grpc, nid_service_auth::ServerAuth::from_env(&bind)?))
        .serve(addr)
        .await?;
    Ok(())
}
