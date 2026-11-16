use newax_access::{
    AccessGrantResponse, AccessService, CreateGrantRequest, MyPermissionsResponse,
    PermissionEntry, TransferOwnershipRequest, UpdateGrantRequest,
};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.access.v1");
}

use proto::{
    access_api_service_server::{AccessApiService as AccessRpc, AccessApiServiceServer},
    AccessGrantResponse as ProtoAccessGrantResponse,
    AccessGrantListResponse, AddPartnerRequest, CreateGrantRequest as ProtoCreateGrantRequest,
    Empty, GetGrantRequest, GetMyPermissionsRequest, GetMyPermissionsRequest as ProtoMyPermsReq,
    ListGrantsRequest, MyPermissionsResponse as ProtoMyPermissionsResponse,
    PermissionEntry as ProtoPermissionEntry, RevokeGrantRequest,
    TransferOwnershipRequest as ProtoTransferOwnershipRequest, UpdateGrantRequest as ProtoUpdateGrantRequest,
};

struct AccessGrpc {
    service: AccessService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") {
        Status::not_found(msg)
    } else if msg.contains("Only tenant owners") || msg.contains("not authorized") {
        Status::permission_denied(msg)
    } else if msg.contains("already") {
        Status::already_exists(msg)
    } else {
        Status::internal(msg)
    }
}

fn grant_to_proto(g: AccessGrantResponse) -> ProtoAccessGrantResponse {
    ProtoAccessGrantResponse {
        id: g.id,
        account_id: g.account_id,
        tenant_id: g.tenant_id,
        organization_id: g.organization_id,
        brand_id: g.brand_id,
        access_type: g.access_type,
        partnership_percentage: g.partnership_percentage,
        granted_by: g.granted_by,
        status: g.status,
        granted_at: g.granted_at,
        account_phone: g.account_phone,
        account_email: g.account_email,
    }
}

fn permission_to_proto(p: PermissionEntry) -> ProtoPermissionEntry {
    ProtoPermissionEntry {
        group_name: p.group_name,
        service_name: p.service_name,
        permission_key: p.permission_key,
        label: p.label,
        granted: p.granted,
    }
}

#[tonic::async_trait]
impl AccessRpc for AccessGrpc {
    async fn create_grant(
        &self,
        req: Request<ProtoCreateGrantRequest>,
    ) -> Result<Response<ProtoAccessGrantResponse>, Status> {
        let r = req.into_inner();
        let grant_req = CreateGrantRequest {
            account_id: r.account_id,
            organization_id: r.organization_id,
            brand_id: r.brand_id,
            access_type: r.access_type,
            partnership_percentage: r.partnership_percentage,
        };
        let result = self
            .service
            .create_grant(&r.caller_id, &r.tenant_id, &grant_req)
            .await
            .map_err(to_status)?;
        Ok(Response::new(grant_to_proto(result)))
    }

    async fn list_grants(
        &self,
        req: Request<ListGrantsRequest>,
    ) -> Result<Response<AccessGrantListResponse>, Status> {
        let r = req.into_inner();
        let grants = self
            .service
            .list_grants(
                &r.caller_id,
                &r.tenant_id,
                r.organization_id.as_deref(),
                r.brand_id.as_deref(),
            )
            .await
            .map_err(to_status)?;
        Ok(Response::new(AccessGrantListResponse {
            grants: grants.into_iter().map(grant_to_proto).collect(),
        }))
    }

    async fn get_grant(
        &self,
        req: Request<GetGrantRequest>,
    ) -> Result<Response<ProtoAccessGrantResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .get_grant(&r.caller_id, &r.tenant_id, &r.grant_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(grant_to_proto(result)))
    }

    async fn update_grant(
        &self,
        req: Request<ProtoUpdateGrantRequest>,
    ) -> Result<Response<ProtoAccessGrantResponse>, Status> {
        let r = req.into_inner();
        let update_req = UpdateGrantRequest {
            access_type: r.access_type,
            partnership_percentage: r.partnership_percentage,
            status: r.status,
        };
        let result = self
            .service
            .update_grant(&r.caller_id, &r.tenant_id, &r.grant_id, &update_req)
            .await
            .map_err(to_status)?;
        Ok(Response::new(grant_to_proto(result)))
    }

    async fn revoke_grant(
        &self,
        req: Request<RevokeGrantRequest>,
    ) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service
            .revoke_grant(&r.caller_id, &r.tenant_id, &r.grant_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn transfer_ownership(
        &self,
        req: Request<ProtoTransferOwnershipRequest>,
    ) -> Result<Response<ProtoAccessGrantResponse>, Status> {
        let r = req.into_inner();
        let transfer_req = TransferOwnershipRequest {
            new_owner_id: r.new_owner_id,
            organization_id: r.organization_id,
            brand_id: r.brand_id,
        };
        let result = self
            .service
            .transfer_ownership(&r.caller_id, &r.tenant_id, &transfer_req)
            .await
            .map_err(to_status)?;
        Ok(Response::new(grant_to_proto(result)))
    }

    async fn add_partner(
        &self,
        req: Request<AddPartnerRequest>,
    ) -> Result<Response<ProtoAccessGrantResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .add_partner(&r.caller_id, &r.tenant_id, &r.account_id, r.percentage)
            .await
            .map_err(to_status)?;
        Ok(Response::new(grant_to_proto(result)))
    }

    async fn get_my_permissions(
        &self,
        req: Request<ProtoMyPermsReq>,
    ) -> Result<Response<ProtoMyPermissionsResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .get_my_permissions(
                &r.account_id,
                &r.tenant_id,
                r.organization_id.as_deref(),
                r.brand_id.as_deref(),
            )
            .await
            .map_err(to_status)?;
        Ok(Response::new(ProtoMyPermissionsResponse {
            account_id: result.account_id,
            tenant_id: result.tenant_id,
            permissions: result.permissions.into_iter().map(permission_to_proto).collect(),
        }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_access=debug").unwrap())
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("ACCESS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(50086);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let grpc = AccessGrpc {
        service: AccessService::new(pool),
    };

    info!(port, "svc-access starting (gRPC)");
    nid_service_auth::server_builder()?
        .add_service(AccessApiServiceServer::with_interceptor(grpc, nid_service_auth::ServerAuth::from_env(&bind)?))
        .serve(addr)
        .await?;
    Ok(())
}
