use newax_organizations::{
    BeneficialOwnerResponse, CreateOrganizationRequest, MembershipResponse, MyMembershipResponse,
    OrganizationResponse, OrganizationsService,
};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.organizations.v1");
}

use proto::{
    organizations_api_service_server::{
        OrganizationsApiService as OrgRpc, OrganizationsApiServiceServer,
    },
    AccountIdRequest, ActiveAdminRequest, ActiveMemberRequest,
    BeneficialOwnerListResponse, BeneficialOwnerResponse as ProtoBeneficialOwnerResponse,
    CreateOrganizationRequest as ProtoCreateOrgRequest, Empty, GetOrganizationRequest,
    InviteMemberRequest, MembershipListResponse,
    MembershipResponse as ProtoMembershipResponse,
    MyMembership, MyMembershipListResponse,
    OrganizationListResponse,
    OrganizationResponse as ProtoOrganizationResponse, RespondToInviteRequest, TenantIdRequest,
    TenantIdResponse,
};

struct OrgGrpc {
    service: OrganizationsService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") {
        Status::not_found(msg)
    } else if msg.contains("not an admin") || msg.contains("not a member") {
        Status::permission_denied(msg)
    } else {
        Status::internal(msg)
    }
}

fn org_to_proto(o: OrganizationResponse) -> ProtoOrganizationResponse {
    ProtoOrganizationResponse {
        id: o.id,
        tenant_id: o.tenant_id,
        subject_id: o.subject_id,
        legal_name: o.legal_name,
        registration_number: o.registration_number,
        country_code: o.country_code,
        address: o.address,
        created_at: o.created_at,
        updated_at: o.updated_at,
    }
}

fn my_membership_to_proto(m: MyMembershipResponse) -> MyMembership {
    MyMembership {
        organization_id: m.organization_id,
        organization_name: m.organization_name,
        country_code: m.country_code,
        role: m.role,
        is_admin: m.is_admin,
        tenant_id: m.tenant_id,
    }
}

fn membership_to_proto(m: MembershipResponse) -> ProtoMembershipResponse {
    ProtoMembershipResponse {
        id: m.id,
        tenant_id: m.tenant_id,
        organization_id: m.organization_id,
        subject_id: m.subject_id,
        role: m.role,
        status: m.status,
        phone: m.phone,
        account_id: m.account_id,
        created_at: m.created_at,
    }
}

fn bo_to_proto(b: BeneficialOwnerResponse) -> ProtoBeneficialOwnerResponse {
    ProtoBeneficialOwnerResponse {
        id: b.id,
        tenant_id: b.tenant_id,
        organization_id: b.organization_id,
        person_subject_id: b.person_subject_id,
        role: b.role,
        created_at: b.created_at,
    }
}

#[tonic::async_trait]
impl OrgRpc for OrgGrpc {
    async fn create(
        &self,
        req: Request<ProtoCreateOrgRequest>,
    ) -> Result<Response<ProtoOrganizationResponse>, Status> {
        let r = req.into_inner();
        let create_req = CreateOrganizationRequest {
            subject_id: r.subject_id,
            legal_name: r.legal_name,
            registration_number: r.registration_number,
            country_code: r.country_code,
            address: r.address,
        };
        let result = self
            .service
            .create(&r.tenant_id, &r.api_key_id, &create_req)
            .await
            .map_err(to_status)?;
        Ok(Response::new(org_to_proto(result)))
    }

    async fn list_all(
        &self,
        req: Request<TenantIdRequest>,
    ) -> Result<Response<OrganizationListResponse>, Status> {
        let r = req.into_inner();
        let orgs = self
            .service
            .list_all(&r.tenant_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(OrganizationListResponse {
            organizations: orgs.into_iter().map(org_to_proto).collect(),
        }))
    }

    async fn get_by_id(
        &self,
        req: Request<GetOrganizationRequest>,
    ) -> Result<Response<ProtoOrganizationResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .get_by_id(&r.tenant_id, &r.org_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(org_to_proto(result)))
    }

    async fn list_memberships(
        &self,
        req: Request<GetOrganizationRequest>,
    ) -> Result<Response<MembershipListResponse>, Status> {
        let r = req.into_inner();
        let memberships = self
            .service
            .list_memberships(&r.tenant_id, &r.org_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(MembershipListResponse {
            memberships: memberships.into_iter().map(membership_to_proto).collect(),
        }))
    }

    async fn invite_member(
        &self,
        req: Request<InviteMemberRequest>,
    ) -> Result<Response<ProtoMembershipResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .invite_member(&r.tenant_id, &r.org_id, &r.phone, &r.role, &r.api_key_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(membership_to_proto(result)))
    }

    async fn list_beneficial_owners(
        &self,
        req: Request<GetOrganizationRequest>,
    ) -> Result<Response<BeneficialOwnerListResponse>, Status> {
        let r = req.into_inner();
        let owners = self
            .service
            .list_beneficial_owners(&r.tenant_id, &r.org_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(BeneficialOwnerListResponse {
            owners: owners.into_iter().map(bo_to_proto).collect(),
        }))
    }

    async fn require_active_admin(
        &self,
        req: Request<ActiveAdminRequest>,
    ) -> Result<Response<TenantIdResponse>, Status> {
        let r = req.into_inner();
        let tenant_id = self
            .service
            .require_active_admin(&r.organization_id, &r.account_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(TenantIdResponse { tenant_id }))
    }

    async fn require_active_member(
        &self,
        req: Request<ActiveMemberRequest>,
    ) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service
            .require_active_member(&r.organization_id, &r.account_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn list_my_memberships(
        &self,
        req: Request<AccountIdRequest>,
    ) -> Result<Response<MyMembershipListResponse>, Status> {
        let r = req.into_inner();
        let memberships = self
            .service
            .list_my_memberships(&r.account_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(MyMembershipListResponse {
            memberships: memberships.into_iter().map(my_membership_to_proto).collect(),
        }))
    }

    async fn list_my_invites(
        &self,
        req: Request<AccountIdRequest>,
    ) -> Result<Response<MembershipListResponse>, Status> {
        let r = req.into_inner();
        let invites = self
            .service
            .list_my_invites(&r.account_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(MembershipListResponse {
            memberships: invites.into_iter().map(membership_to_proto).collect(),
        }))
    }

    async fn respond_to_invite(
        &self,
        req: Request<RespondToInviteRequest>,
    ) -> Result<Response<ProtoMembershipResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .respond_to_invite(&r.account_id, &r.membership_id, &r.response)
            .await
            .map_err(to_status)?;
        Ok(Response::new(membership_to_proto(result)))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_new("info,svc_organizations=debug").unwrap(),
        )
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("ORGANIZATIONS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(50087);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let grpc = OrgGrpc {
        service: OrganizationsService::new(pool),
    };

    info!(port, "svc-organizations starting (gRPC)");
    nid_service_auth::server_builder()?
        .add_service(OrganizationsApiServiceServer::with_interceptor(grpc, nid_service_auth::ServerAuth::from_env(&bind)?))
        .serve(addr)
        .await?;
    Ok(())
}
