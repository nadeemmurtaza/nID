use newax_subjects::{
    AttributeBadgesResponse as LogicAttributeBadgesResponse, BadgesResponse as LogicBadgesResponse,
    CreateSubjectRequest as LogicCreateRequest, SubjectResponse as LogicSubjectResponse, SubjectType, SubjectsService,
};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.subjects.v1");
}

use proto::{
    subjects_service_server::{SubjectsService as SubjectsRpc, SubjectsServiceServer},
    AttributeBadgeResponse, AttributeBadgesResponse, BadgeResponse, BadgesResponse, CreateRequest, GetBadgesRequest,
    GetByIdRequest, SubjectResponse,
};

struct Grpc {
    service: SubjectsService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") {
        Status::not_found(msg)
    } else {
        Status::internal(msg)
    }
}

fn subject_to_proto(s: LogicSubjectResponse) -> SubjectResponse {
    SubjectResponse {
        id: s.id,
        tenant_id: s.tenant_id,
        external_ref: s.external_ref,
        r#type: s.r#type,
        given_name: s.given_name,
        family_name: s.family_name,
        email: s.email,
        phone: s.phone,
        date_of_birth: s.date_of_birth,
        national_id_number: s.national_id_number,
        address_line1: s.address_line1,
        address_line2: s.address_line2,
        city: s.city,
        region: s.region,
        country_code: s.country_code,
        latitude: s.latitude,
        longitude: s.longitude,
        account_id: s.account_id,
        created_at: s.created_at,
        updated_at: s.updated_at,
    }
}

fn badges_to_proto(b: LogicBadgesResponse) -> BadgesResponse {
    BadgesResponse {
        subject_id: b.subject_id,
        badges: b
            .badges
            .into_iter()
            .map(|e| BadgeResponse { claim_type: e.claim_type, level: e.level, verified_at: e.verified_at, case_id: e.case_id })
            .collect(),
    }
}

fn attribute_badges_to_proto(b: LogicAttributeBadgesResponse) -> AttributeBadgesResponse {
    AttributeBadgesResponse {
        subject_id: b.subject_id,
        badges: b
            .badges
            .into_iter()
            .map(|e| AttributeBadgeResponse {
                attribute: e.attribute,
                level: e.level,
                verified_at: e.verified_at,
                case_id: e.case_id,
                method: e.method,
            })
            .collect(),
    }
}

#[tonic::async_trait]
impl SubjectsRpc for Grpc {
    async fn create(&self, req: Request<CreateRequest>) -> Result<Response<SubjectResponse>, Status> {
        let r = req.into_inner();
        let subject_type = match r.r#type.as_str() {
            "ORGANIZATION" => Some(SubjectType::Organization),
            "PERSON" => Some(SubjectType::Person),
            _ => None,
        };
        let logic_req = LogicCreateRequest {
            r#type: subject_type,
            external_ref: r.external_ref,
            given_name: r.given_name,
            family_name: r.family_name,
            email: r.email,
            phone: r.phone,
            date_of_birth: r.date_of_birth,
            address_line1: r.address_line1,
            address_line2: r.address_line2,
            city: r.city,
            region: r.region,
            country_code: r.country_code,
            latitude: r.latitude,
            longitude: r.longitude,
        };
        let subject = self.service.create(&r.tenant_id, &r.api_key_id, &logic_req).await.map_err(to_status)?;
        Ok(Response::new(subject_to_proto(subject)))
    }

    async fn get_by_id(&self, req: Request<GetByIdRequest>) -> Result<Response<SubjectResponse>, Status> {
        let r = req.into_inner();
        let subject = self.service.get_by_id(&r.tenant_id, &r.api_key_id, &r.subject_id).await.map_err(to_status)?;
        Ok(Response::new(subject_to_proto(subject)))
    }

    async fn get_badges(&self, req: Request<GetBadgesRequest>) -> Result<Response<BadgesResponse>, Status> {
        let r = req.into_inner();
        let badges = self
            .service
            .get_badges(&r.tenant_id, &r.actor_type, &r.actor_id, &r.subject_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(badges_to_proto(badges)))
    }

    async fn get_attribute_badges(&self, req: Request<GetBadgesRequest>) -> Result<Response<AttributeBadgesResponse>, Status> {
        let r = req.into_inner();
        let badges = self
            .service
            .get_attribute_badges(&r.tenant_id, &r.actor_type, &r.actor_id, &r.subject_id)
            .await
            .map_err(to_status)?;
        Ok(Response::new(attribute_badges_to_proto(badges)))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_subjects=debug").unwrap())
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("SUBJECTS_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(50077);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let grpc = Grpc { service: SubjectsService::new(pool) };

    info!(port, "svc-subjects starting (gRPC)");
    Server::builder()
        .add_service(SubjectsServiceServer::new(grpc))
        .serve(addr)
        .await?;
    Ok(())
}
