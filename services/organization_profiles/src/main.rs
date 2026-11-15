use newax_organization_profiles::{
    OrgProfileFieldGrantResponse, OrgProfileResponse, OrganizationProfilesService,
    UpdateOrgProfileRequest,
};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.organization_profiles.v1");
}

use proto::{
    organization_profiles_api_service_server::{
        OrganizationProfilesApiService as OrgProfilesRpc,
        OrganizationProfilesApiServiceServer,
    },
    CreateOrgGrantRequest as ProtoCreateGrantReq,
    CreateOrgProfileRequest as ProtoCreateReq,
    OrgIdRequest, OrgProfileFieldGrantListResponse,
    OrgProfileFieldGrantResponse as ProtoGrantResponse,
    OrgProfileResponse as ProtoProfileResponse,
    RevokeGrantRequest, UpdateOrgProfileRequest as ProtoUpdateReq,
};

struct OrgProfilesGrpc {
    service: OrganizationProfilesService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") {
        Status::not_found(msg)
    } else if msg.contains("not authorized") {
        Status::permission_denied(msg)
    } else {
        Status::internal(msg)
    }
}

fn profile_to_proto(r: OrgProfileResponse) -> ProtoProfileResponse {
    ProtoProfileResponse {
        id: r.id,
        organization_id: r.organization_id,
        slug: r.slug,
        display_name: r.display_name,
        headline: r.headline,
        category: r.category,
        bio: r.bio,
        photo_key: r.photo_key,
        phone: r.phone,
        whatsapp: r.whatsapp,
        public_email: r.public_email,
        address_line1: r.address_line1,
        address_line2: r.address_line2,
        city: r.city,
        region: r.region,
        country_code: r.country_code,
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone,
        show_phone: r.show_phone,
        show_whatsapp: r.show_whatsapp,
        show_email: r.show_email,
        show_address: r.show_address,
        show_badges: r.show_badges,
        show_booking: r.show_booking,
        show_offers: r.show_offers,
        show_hours: r.show_hours,
        is_published: r.is_published,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }
}

fn grant_to_proto(g: OrgProfileFieldGrantResponse) -> ProtoGrantResponse {
    ProtoGrantResponse {
        id: g.id,
        profile_id: g.profile_id,
        field: g.field,
        grantee_account_id: g.grantee_account_id,
        grantee_organization_id: g.grantee_organization_id,
        created_at: g.created_at,
        revoked_at: g.revoked_at,
    }
}

#[tonic::async_trait]
impl OrgProfilesRpc for OrgProfilesGrpc {
    async fn create_for_organization(
        &self,
        req: Request<ProtoCreateReq>,
    ) -> Result<Response<ProtoProfileResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .create_for_organization(
                &r.account_id,
                &r.organization_id,
                &r.slug,
                &r.display_name,
                r.headline.as_deref(),
                r.category.as_deref(),
                r.bio.as_deref(),
                r.phone.as_deref(),
                r.whatsapp.as_deref(),
                r.public_email.as_deref(),
                r.address_line1.as_deref(),
                r.address_line2.as_deref(),
                r.city.as_deref(),
                r.region.as_deref(),
                r.country_code.as_deref(),
                r.latitude,
                r.longitude,
                r.timezone.as_deref(),
                r.show_phone,
                r.show_whatsapp,
                r.show_email,
                r.show_address,
                r.show_badges,
                r.show_booking,
                r.show_offers,
                r.show_hours,
                r.is_published,
            )
            .await
            .map_err(to_status)?;
        Ok(Response::new(profile_to_proto(result)))
    }

    async fn get_for_organization(
        &self,
        req: Request<OrgIdRequest>,
    ) -> Result<Response<ProtoProfileResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .get_for_organization(&r.account_id, &r.organization_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(profile_to_proto(result)))
    }

    async fn update_for_organization(
        &self,
        req: Request<ProtoUpdateReq>,
    ) -> Result<Response<ProtoProfileResponse>, Status> {
        let r = req.into_inner();
        let update_req = UpdateOrgProfileRequest {
            display_name: r.display_name,
            headline: r.headline,
            category: r.category,
            bio: r.bio.map(Some),
            phone: r.phone,
            whatsapp: r.whatsapp,
            public_email: r.public_email,
            address_line1: r.address_line1,
            address_line2: r.address_line2,
            city: r.city,
            region: r.region,
            country_code: r.country_code,
            latitude: r.latitude,
            longitude: r.longitude,
            timezone: r.timezone,
            show_phone: r.show_phone,
            show_whatsapp: r.show_whatsapp,
            show_email: r.show_email,
            show_address: r.show_address,
            show_badges: r.show_badges,
            show_booking: r.show_booking,
            show_offers: r.show_offers,
            show_hours: r.show_hours,
            is_published: r.is_published,
        };
        let result = self
            .service
            .update_for_organization(&r.account_id, &r.organization_id, &update_req)
            .await
            .map_err(to_status)?;
        Ok(Response::new(profile_to_proto(result)))
    }

    async fn create_grant_for_organization(
        &self,
        req: Request<ProtoCreateGrantReq>,
    ) -> Result<Response<ProtoGrantResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .create_grant_for_organization(
                &r.account_id,
                &r.organization_id,
                &r.field,
                None,
                None,
            )
            .await
            .map_err(to_status)?;
        Ok(Response::new(grant_to_proto(result)))
    }

    async fn list_grants_for_organization(
        &self,
        req: Request<OrgIdRequest>,
    ) -> Result<Response<OrgProfileFieldGrantListResponse>, Status> {
        let r = req.into_inner();
        let grants = self
            .service
            .list_grants_for_organization(&r.account_id, &r.organization_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(OrgProfileFieldGrantListResponse {
            grants: grants.into_iter().map(grant_to_proto).collect(),
        }))
    }

    async fn revoke_grant_for_organization(
        &self,
        req: Request<RevokeGrantRequest>,
    ) -> Result<Response<ProtoGrantResponse>, Status> {
        let r = req.into_inner();
        let result = self
            .service
            .revoke_grant_for_organization(&r.account_id, &r.organization_id, &r.grant_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(grant_to_proto(result)))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_new("info,svc_organization_profiles=debug")
                .unwrap(),
        )
        .init();

    let database_url = std::env::var("APP_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .map_err(|_| "APP_DATABASE_URL (or DATABASE_URL) must be set")?;
    let pool = PgPoolOptions::new().max_connections(5).connect(&database_url).await?;

    let port: u16 = std::env::var("ORG_PROFILES_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(50084);
    let addr = format!("0.0.0.0:{port}").parse()?;

    let grpc = OrgProfilesGrpc {
        service: OrganizationProfilesService::new(pool),
    };

    info!(port, "svc-organization-profiles starting (gRPC)");
    Server::builder()
        .add_service(OrganizationProfilesApiServiceServer::new(grpc))
        .serve(addr)
        .await?;
    Ok(())
}
