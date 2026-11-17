use newax_booking::{AppointmentResponse, AvailabilityRuleResponse, BookingService, FreeSlotResponse, ProfileOwner, ServiceResponse};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.booking.v1");
}

use proto::{
    booking_api_service_server::{BookingApiService as BookingRpc, BookingApiServiceServer},
    AccountIdRequest, AppointmentListResponse, AppointmentResponse as ProtoAppointment,
    AvailabilityRuleListResponse, AvailabilityRuleResponse as ProtoAvailabilityRule,
    CancelAppointmentRequest, ConfirmAppointmentRequest, ComputeFreeSlotsRequest,
    CreateAvailabilityRuleRequest, CreatePublicAppointmentRequest, CreateServiceRequest,
    Empty, FreeSlotListResponse, FreeSlotResponse as ProtoFreeSlot,
    RemoveAvailabilityRuleRequest, RemoveServiceRequest, ServiceListResponse,
    ServiceResponse as ProtoService, SlugRequest,
    UpdateAvailabilityRuleRequest, UpdateServiceRequest,
};

struct BookingGrpc {
    service: BookingService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") || msg.contains("No profile found") || msg.contains("has no public profile yet") {
        Status::not_found(msg)
    } else if msg.contains("already") {
        Status::already_exists(msg)
    } else if msg.contains("not authorized") {
        Status::permission_denied(msg)
    } else if msg.contains("must be verified") {
        Status::failed_precondition(msg)
    } else if msg.contains("Invalid") || msg.contains("not accepting") {
        Status::invalid_argument(msg)
    } else {
        Status::internal(msg)
    }
}

fn service_to_proto(s: ServiceResponse) -> ProtoService {
    ProtoService {
        id: s.id,
        profile_id: s.profile_id,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price,
        currency: s.currency,
        description: s.description,
        is_active: s.is_active,
    }
}

fn availability_rule_to_proto(a: AvailabilityRuleResponse) -> ProtoAvailabilityRule {
    ProtoAvailabilityRule {
        id: a.id,
        profile_id: a.profile_id,
        day: a.day,
        start_minute: a.start_minute,
        end_minute: a.end_minute,
        is_active: a.is_active,
    }
}

fn appointment_to_proto(a: AppointmentResponse) -> ProtoAppointment {
    ProtoAppointment {
        id: a.id,
        profile_id: a.profile_id,
        service_id: a.service_id,
        starts_at: a.starts_at,
        ends_at: a.ends_at,
        status: a.status,
        visitor_name: a.visitor_name,
        visitor_phone: a.visitor_phone,
        visitor_email: a.visitor_email,
        notes: a.notes,
        service_name: a.service_name,
    }
}

fn free_slot_to_proto(s: FreeSlotResponse) -> ProtoFreeSlot {
    ProtoFreeSlot { starts_at: s.starts_at, ends_at: s.ends_at }
}

/// account_id is always the *caller* -- organization_id, when set, means
/// "resolve to the work profile of this organization (which the caller
/// must administer)" instead of the caller's own personal profile.
fn owner_of<'a>(account_id: &'a str, organization_id: &'a Option<String>) -> ProfileOwner<'a> {
    match organization_id {
        Some(org_id) if !org_id.is_empty() => ProfileOwner::Organization(account_id, org_id),
        _ => ProfileOwner::Account(account_id),
    }
}

#[tonic::async_trait]
impl BookingRpc for BookingGrpc {
    async fn create_service(&self, req: Request<CreateServiceRequest>) -> Result<Response<ProtoService>, Status> {
        let r = req.into_inner();
        let owner = owner_of(&r.account_id, &r.organization_id);
        let result = self.service.create_service(&owner, &r.name, r.duration_minutes, r.price, r.currency.as_deref(), r.description.as_deref(), r.is_active).await.map_err(to_status)?;
        Ok(Response::new(service_to_proto(result)))
    }

    async fn list_my_services(&self, req: Request<AccountIdRequest>) -> Result<Response<ServiceListResponse>, Status> {
        let r = req.into_inner();
        let owner = owner_of(&r.account_id, &r.organization_id);
        let services = self.service.list_my_services(&owner).await.map_err(to_status)?;
        Ok(Response::new(ServiceListResponse {
            services: services.into_iter().map(service_to_proto).collect(),
        }))
    }

    async fn update_service(&self, req: Request<UpdateServiceRequest>) -> Result<Response<ProtoService>, Status> {
        let r = req.into_inner();
        let owner = owner_of(&r.account_id, &r.organization_id);
        let result = self.service.update_service(&owner, &r.service_id, r.name.as_deref(), r.duration_minutes, r.price, r.is_active, r.description.as_deref(), r.currency.as_deref()).await.map_err(to_status)?;
        Ok(Response::new(service_to_proto(result)))
    }

    async fn remove_service(&self, req: Request<RemoveServiceRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        let owner = owner_of(&r.account_id, &r.organization_id);
        self.service.remove_service(&owner, &r.service_id).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn create_availability_rule(&self, req: Request<CreateAvailabilityRuleRequest>) -> Result<Response<ProtoAvailabilityRule>, Status> {
        let r = req.into_inner();
        let owner = owner_of(&r.account_id, &r.organization_id);
        let result = self.service.create_availability_rule(&owner, &r.day, r.start_minute, r.end_minute, r.is_active).await.map_err(to_status)?;
        Ok(Response::new(availability_rule_to_proto(result)))
    }

    async fn list_my_availability_rules(&self, req: Request<AccountIdRequest>) -> Result<Response<AvailabilityRuleListResponse>, Status> {
        let r = req.into_inner();
        let owner = owner_of(&r.account_id, &r.organization_id);
        let rules = self.service.list_my_availability_rules(&owner).await.map_err(to_status)?;
        Ok(Response::new(AvailabilityRuleListResponse {
            rules: rules.into_iter().map(availability_rule_to_proto).collect(),
        }))
    }

    async fn remove_availability_rule(&self, req: Request<RemoveAvailabilityRuleRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        let owner = owner_of(&r.account_id, &r.organization_id);
        self.service.remove_availability_rule(&owner, &r.rule_id).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn update_availability_rule(&self, req: Request<UpdateAvailabilityRuleRequest>) -> Result<Response<ProtoAvailabilityRule>, Status> {
        let r = req.into_inner();
        let owner = owner_of(&r.account_id, &r.organization_id);
        let result = self.service.update_availability_rule(&owner, &r.rule_id, r.day.as_deref(), r.start_minute, r.end_minute, r.is_active).await.map_err(to_status)?;
        Ok(Response::new(availability_rule_to_proto(result)))
    }

    async fn compute_free_slots(&self, req: Request<ComputeFreeSlotsRequest>) -> Result<Response<FreeSlotListResponse>, Status> {
        let r = req.into_inner();
        let slots = self.service.compute_free_slots(&r.slug, &r.service_id, &r.from, &r.to).await.map_err(to_status)?;
        Ok(Response::new(FreeSlotListResponse {
            slots: slots.into_iter().map(free_slot_to_proto).collect(),
        }))
    }

    async fn list_my_appointments(&self, req: Request<AccountIdRequest>) -> Result<Response<AppointmentListResponse>, Status> {
        let r = req.into_inner();
        let owner = owner_of(&r.account_id, &r.organization_id);
        let appointments = self.service.list_my_appointments(&owner).await.map_err(to_status)?;
        Ok(Response::new(AppointmentListResponse {
            appointments: appointments.into_iter().map(appointment_to_proto).collect(),
        }))
    }

    async fn confirm_appointment(&self, req: Request<ConfirmAppointmentRequest>) -> Result<Response<ProtoAppointment>, Status> {
        let r = req.into_inner();
        let owner = owner_of(&r.account_id, &r.organization_id);
        let result = self.service.confirm_appointment(&owner, &r.appointment_id).await.map_err(to_status)?;
        Ok(Response::new(appointment_to_proto(result)))
    }

    async fn cancel_appointment(&self, req: Request<CancelAppointmentRequest>) -> Result<Response<ProtoAppointment>, Status> {
        let r = req.into_inner();
        let owner = owner_of(&r.account_id, &r.organization_id);
        let result = self.service.cancel_appointment(&owner, &r.appointment_id).await.map_err(to_status)?;
        Ok(Response::new(appointment_to_proto(result)))
    }

    async fn list_public_services(&self, req: Request<SlugRequest>) -> Result<Response<ServiceListResponse>, Status> {
        let r = req.into_inner();
        let services = self.service.list_public_services(&r.slug).await.map_err(to_status)?;
        Ok(Response::new(ServiceListResponse {
            services: services.into_iter().map(service_to_proto).collect(),
        }))
    }

    async fn create_public_appointment(&self, req: Request<CreatePublicAppointmentRequest>) -> Result<Response<ProtoAppointment>, Status> {
        let r = req.into_inner();
        let result = self.service.create_public_appointment(&r.slug, &r.service_id, &r.starts_at, &r.visitor_name, r.visitor_phone.as_deref(), r.visitor_email.as_deref(), r.notes.as_deref()).await.map_err(to_status)?;
        Ok(Response::new(appointment_to_proto(result)))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_booking=debug").unwrap())
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("BOOKING_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(50083);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let grpc = BookingGrpc { service: BookingService::new(pool) };

    info!(port, "svc-booking starting (gRPC)");
    nid_service_auth::server_builder()?
        .add_service(BookingApiServiceServer::with_interceptor(grpc, nid_service_auth::ServerAuth::from_env(&bind)?))
        .serve(addr)
        .await?;
    Ok(())
}
