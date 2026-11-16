use newax_departments::{
    AssignDepartmentRequest as LogicAssignRequest, CreateDepartmentRequest as LogicCreateRequest,
    DepartmentAssignmentResponse as LogicAssignmentResponse, DepartmentResponse as LogicDepartmentResponse,
    DepartmentsService, UpdateDepartmentRequest as LogicUpdateRequest,
};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.departments.v1");
}

use proto::{
    departments_service_server::{DepartmentsService as DepartmentsRpc, DepartmentsServiceServer},
    AccountDepartmentsRequest, AssignDepartmentRequest, CreateDepartmentRequest, DepartmentAssignmentResponse,
    DepartmentAssignmentsResponse, DepartmentIdRequest, DepartmentResponse, DepartmentsResponse, Empty,
    RemoveAssignmentRequest, TenantScopedRequest, UpdateDepartmentRequest,
};

struct Grpc {
    service: DepartmentsService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("already") {
        Status::already_exists(msg)
    } else if msg.contains("not found") {
        Status::not_found(msg)
    } else if msg.contains("Only tenant owners") || msg.contains("do not have access") {
        Status::permission_denied(msg)
    } else {
        Status::internal(msg)
    }
}

fn dept_to_proto(d: LogicDepartmentResponse) -> DepartmentResponse {
    DepartmentResponse {
        id: d.id,
        tenant_id: d.tenant_id,
        name: d.name,
        slug: d.slug,
        default_permissions_json: d.default_permissions.map(|v| v.to_string()),
        icon: d.icon,
        color: d.color,
        inherited_from_tenant: d.inherited_from_tenant,
        created_at: d.created_at,
        updated_at: d.updated_at,
    }
}

fn assignment_to_proto(a: LogicAssignmentResponse) -> DepartmentAssignmentResponse {
    DepartmentAssignmentResponse {
        id: a.id,
        account_id: a.account_id,
        department_id: a.department_id,
        tenant_id: a.tenant_id,
        organization_id: a.organization_id,
        brand_id: a.brand_id,
        scope: a.scope,
        created_at: a.created_at,
    }
}

#[tonic::async_trait]
impl DepartmentsRpc for Grpc {
    async fn create_department(&self, req: Request<CreateDepartmentRequest>) -> Result<Response<DepartmentResponse>, Status> {
        let r = req.into_inner();
        let logic_req = LogicCreateRequest {
            name: r.name,
            slug: r.slug,
            default_permissions: r.default_permissions_json.and_then(|s| serde_json::from_str(&s).ok()),
            icon: r.icon,
            color: r.color,
        };
        let dept = self.service.create_department(&r.account_id, &r.tenant_id, &logic_req).await.map_err(to_status)?;
        Ok(Response::new(dept_to_proto(dept)))
    }

    async fn list_departments(&self, req: Request<TenantScopedRequest>) -> Result<Response<DepartmentsResponse>, Status> {
        let r = req.into_inner();
        let depts = self.service.list_departments(&r.account_id, &r.tenant_id).await.map_err(to_status)?;
        Ok(Response::new(DepartmentsResponse { departments: depts.into_iter().map(dept_to_proto).collect() }))
    }

    async fn get_department(&self, req: Request<DepartmentIdRequest>) -> Result<Response<DepartmentResponse>, Status> {
        let r = req.into_inner();
        let dept = self.service.get_department(&r.account_id, &r.tenant_id, &r.department_id).await.map_err(to_status)?;
        Ok(Response::new(dept_to_proto(dept)))
    }

    async fn update_department(&self, req: Request<UpdateDepartmentRequest>) -> Result<Response<DepartmentResponse>, Status> {
        let r = req.into_inner();
        let logic_req = LogicUpdateRequest {
            name: r.name,
            default_permissions: r.default_permissions_json.and_then(|s| serde_json::from_str(&s).ok()),
            icon: if r.icon_set { Some(r.icon) } else { None },
            color: if r.color_set { Some(r.color) } else { None },
        };
        let dept = self
            .service
            .update_department(&r.account_id, &r.tenant_id, &r.department_id, &logic_req)
            .await
            .map_err(to_status)?;
        Ok(Response::new(dept_to_proto(dept)))
    }

    async fn assign_department(&self, req: Request<AssignDepartmentRequest>) -> Result<Response<DepartmentAssignmentResponse>, Status> {
        let r = req.into_inner();
        let logic_req = LogicAssignRequest {
            account_id: r.target_account_id,
            organization_id: r.organization_id,
            brand_id: r.brand_id,
            scope: r.scope,
        };
        let assignment = self
            .service
            .assign_department(&r.account_id, &r.tenant_id, &r.department_id, &logic_req)
            .await
            .map_err(to_status)?;
        Ok(Response::new(assignment_to_proto(assignment)))
    }

    async fn remove_department_assignment(&self, req: Request<RemoveAssignmentRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service
            .remove_department_assignment(&r.account_id, &r.tenant_id, &r.department_id, &r.target_account_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn get_account_departments(
        &self,
        req: Request<AccountDepartmentsRequest>,
    ) -> Result<Response<DepartmentAssignmentsResponse>, Status> {
        let r = req.into_inner();
        let assignments = self
            .service
            .get_account_departments(&r.account_id, &r.tenant_id, &r.target_account_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(DepartmentAssignmentsResponse {
            assignments: assignments.into_iter().map(assignment_to_proto).collect(),
        }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_departments=debug").unwrap())
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("DEPARTMENTS_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(50073);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let grpc = Grpc { service: DepartmentsService::new(pool) };

    info!(port, "svc-departments starting (gRPC)");
    nid_service_auth::server_builder()?
        .add_service(DepartmentsServiceServer::with_interceptor(grpc, nid_service_auth::ServerAuth::from_env(&bind)?))
        .serve(addr)
        .await?;
    Ok(())
}
