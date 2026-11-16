use newax_tenants::{
    ApiKeyResponse, CreatedTenantResponse, NewApiKeyResponse, StaffMemberResponse, TenantsService,
    TenantMembership, TenantResponse, TenantSelfResponse, TenantWithCounts,
};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.tenants.v1");
}

use proto::{
    tenants_api_service_server::{TenantsApiService as TenantsRpc, TenantsApiServiceServer},
    AccountIdRequest, ApiKeyListResponse, ApiKeyResponse as ProtoApiKeyResponse,
    CreateApiKeyRequest, CreateTenantRequest, CreatedTenantResponse as ProtoCreatedTenantResponse,
    Empty, GetSelfRequest, IdRequest, InviteStaffRequest, NewApiKeyResponse as ProtoNewApiKeyResponse,
    RemoveStaffRequest, RevokeApiKeyRequest, StaffMemberListResponse,
    StaffMemberResponse as ProtoStaffMemberResponse, TenantIdRequest,
    TenantListResponse, TenantMembership as ProtoTenantMembership,
    TenantMembershipListResponse, TenantResponse as ProtoTenantResponse,
    TenantSelfResponse as ProtoTenantSelfResponse,
    TenantWithCountsResponse as ProtoTenantWithCounts, UpdateTenantRequest,
};

struct TenantsGrpc {
    service: TenantsService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") {
        Status::not_found(msg)
    } else if msg.contains("already") {
        Status::already_exists(msg)
    } else if msg.contains("Slug must") {
        Status::invalid_argument(msg)
    } else {
        Status::internal(msg)
    }
}

fn tenant_self_to_proto(t: TenantSelfResponse) -> ProtoTenantSelfResponse {
    ProtoTenantSelfResponse {
        id: t.id,
        name: t.name,
        slug: t.slug,
        data_residency_region: t.data_residency_region,
        created_at: t.created_at,
    }
}

fn tenant_to_proto(t: TenantResponse) -> ProtoTenantResponse {
    ProtoTenantResponse {
        id: t.id,
        name: t.name,
        slug: t.slug,
        data_residency_region: t.data_residency_region,
        webhook_url: t.webhook_url,
        billing_webhook_url: t.billing_webhook_url,
        created_at: t.created_at,
        updated_at: t.updated_at,
    }
}

fn tenant_counts_to_proto(t: TenantWithCounts) -> ProtoTenantWithCounts {
    ProtoTenantWithCounts {
        id: t.id,
        name: t.name,
        slug: t.slug,
        data_residency_region: t.data_residency_region,
        webhook_url: t.webhook_url,
        billing_webhook_url: t.billing_webhook_url,
        staff_count: t.staff_count as i32,
        api_key_count: t.api_keys_count as i32,
        created_at: t.created_at,
        updated_at: t.updated_at,
    }
}

fn created_to_proto(t: CreatedTenantResponse) -> ProtoCreatedTenantResponse {
    ProtoCreatedTenantResponse {
        tenant_id: t.id,
        api_key: t.api_key,
        name: t.name,
        slug: t.slug,
        data_residency_region: t.data_residency_region,
        webhook_url: t.webhook_url,
        webhook_secret: t.webhook_secret,
        billing_webhook_url: t.billing_webhook_url,
        billing_webhook_secret: t.billing_webhook_secret,
        created_at: t.created_at,
    }
}

fn membership_to_proto(m: TenantMembership) -> ProtoTenantMembership {
    ProtoTenantMembership {
        tenant_id: m.tenant_id,
        tenant_name: m.tenant_name,
        tenant_slug: m.tenant_slug,
        role: m.role,
        status: String::new(),
    }
}

fn api_key_to_proto(k: ApiKeyResponse) -> ProtoApiKeyResponse {
    ProtoApiKeyResponse {
        id: k.id,
        tenant_id: String::new(),
        name: k.key_prefix,
        scopes: k.scopes,
        rate_limit: Some(k.rate_limit_per_minute),
        created_at: k.created_at,
        revoked_at: k.revoked_at,
    }
}

fn new_api_key_to_proto(k: NewApiKeyResponse) -> ProtoNewApiKeyResponse {
    ProtoNewApiKeyResponse {
        id: k.prefix,
        key: k.plaintext,
    }
}

fn staff_to_proto(s: StaffMemberResponse) -> ProtoStaffMemberResponse {
    ProtoStaffMemberResponse {
        id: s.id,
        tenant_id: String::new(),
        account_id: s.account_id,
        role: s.role,
        status: String::new(),
        phone: s.phone,
        email: None,
        created_at: String::new(),
    }
}

#[tonic::async_trait]
impl TenantsRpc for TenantsGrpc {
    async fn get_self(
        &self,
        req: Request<GetSelfRequest>,
    ) -> Result<Response<ProtoTenantSelfResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .get_self(&r.tenant_id, &r.actor_type)
            .await
            .map_err(to_status)?;
        Ok(Response::new(tenant_self_to_proto(result)))
    }

    async fn get_memberships_for_account(
        &self,
        req: Request<AccountIdRequest>,
    ) -> Result<Response<TenantMembershipListResponse>, Status> {
        let r = req.into_inner();
        let memberships = self
            .service
            .get_memberships_for_account(&r.account_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(TenantMembershipListResponse {
            memberships: memberships.into_iter().map(membership_to_proto).collect(),
        }))
    }

    async fn create(
        &self,
        req: Request<CreateTenantRequest>,
    ) -> Result<Response<ProtoCreatedTenantResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .create(
                &r.name,
                &r.slug,
                r.data_residency_region.as_deref(),
                r.webhook_url.as_deref(),
                r.billing_webhook_url.as_deref(),
                r.initial_staff_account_id.as_deref(),
            )
            .await
            .map_err(to_status)?;
        Ok(Response::new(created_to_proto(result)))
    }

    async fn list_all(&self, _req: Request<Empty>) -> Result<Response<TenantListResponse>, Status> {
        let tenants = self.service.list_all().await.map_err(to_status)?;
        Ok(Response::new(TenantListResponse {
            tenants: tenants.into_iter().map(tenant_counts_to_proto).collect(),
        }))
    }

    async fn get_by_id(
        &self,
        req: Request<IdRequest>,
    ) -> Result<Response<ProtoTenantWithCounts>, Status> {
        let r = req.into_inner();
        let result = self.service.get_by_id(&r.id).await.map_err(to_status)?;
        Ok(Response::new(tenant_counts_to_proto(result)))
    }

    async fn update(
        &self,
        req: Request<UpdateTenantRequest>,
    ) -> Result<Response<ProtoTenantResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .update(
                &r.id,
                r.name.as_deref(),
                r.data_residency_region.as_deref(),
                r.webhook_url.as_deref().map(Some),
                r.billing_webhook_url.as_deref().map(Some),
            )
            .await
            .map_err(to_status)?;
        Ok(Response::new(tenant_to_proto(result)))
    }

    async fn create_api_key(
        &self,
        req: Request<CreateApiKeyRequest>,
    ) -> Result<Response<ProtoNewApiKeyResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .create_api_key(&r.tenant_id, Some(r.scopes), r.rate_limit)
            .await
            .map_err(to_status)?;
        Ok(Response::new(new_api_key_to_proto(result)))
    }

    async fn list_api_keys(
        &self,
        req: Request<TenantIdRequest>,
    ) -> Result<Response<ApiKeyListResponse>, Status> {
        let r = req.into_inner();
        let keys = self
            .service
            .list_api_keys(&r.tenant_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(ApiKeyListResponse {
            api_keys: keys.into_iter().map(api_key_to_proto).collect(),
        }))
    }

    async fn revoke_api_key(
        &self,
        req: Request<RevokeApiKeyRequest>,
    ) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service
            .revoke_api_key(&r.tenant_id, &r.api_key_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn invite_staff(
        &self,
        req: Request<InviteStaffRequest>,
    ) -> Result<Response<ProtoStaffMemberResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .invite_staff(&r.tenant_id, &r.account_id, &r.role)
            .await
            .map_err(to_status)?;
        Ok(Response::new(staff_to_proto(result)))
    }

    async fn list_staff(
        &self,
        req: Request<TenantIdRequest>,
    ) -> Result<Response<StaffMemberListResponse>, Status> {
        let r = req.into_inner();
        let staff = self
            .service
            .list_staff(&r.tenant_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(StaffMemberListResponse {
            staff: staff.into_iter().map(staff_to_proto).collect(),
        }))
    }

    async fn remove_staff(
        &self,
        req: Request<RemoveStaffRequest>,
    ) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service
            .remove_staff(&r.tenant_id, &r.account_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_new("info,svc_tenants=debug").unwrap(),
        )
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("TENANTS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(50089);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let grpc = TenantsGrpc {
        service: TenantsService::new(pool),
    };

    info!(port, "svc-tenants starting (gRPC)");
    Server::builder()
        .add_service(TenantsApiServiceServer::new(grpc))
        .serve(addr)
        .await?;
    Ok(())
}
