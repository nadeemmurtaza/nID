use newax_booking::{AppointmentResponse, AvailabilityRuleResponse, BookingService, FreeSlotResponse, ServiceResponse};
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
    if msg.contains("not found") {
        Status::not_found(msg)
    } else if msg.contains("Invalid") {
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
        price_minor: s.price_minor,
        currency: s.currency,
        description: s.description,
        is_active: s.is_active,
    }
}

fn availability_rule_to_proto(a: AvailabilityRuleResponse) -> ProtoAvailabilityRule {
    ProtoAvailabilityRule {
        id: a.id,
        profile_id: a.profile_id,
        weekday: a.weekday,
        start_time: a.start_time,
        end_time: a.end_time,
    }
}

fn appointment_to_proto(a: AppointmentResponse) -> ProtoAppointment {
    ProtoAppointment {
        id: a.id,
        profile_id: a.profile_id,
        service_id: a.service_id,
        start_time: a.start_time,
        end_time: a.end_time,
        status: a.status,
        subject_name: a.subject_name,
        subject_email: a.subject_email,
    }
}

fn free_slot_to_proto(s: FreeSlotResponse) -> ProtoFreeSlot {
    ProtoFreeSlot {
        start_time: s.start_time,
        end_time: s.end_time,
        is_available: s.is_available,
    }
}

#[tonic::async_trait]
impl BookingRpc for BookingGrpc {
    async fn create_service(&self, req: Request<CreateServiceRequest>) -> Result<Response<ProtoService>, Status> {
        let r = req.into_inner();
        let result = self.service.create_service(&r.account_id, &r.name, r.duration_minutes, r.price_minor, &r.currency, r.description.as_deref()).await.map_err(to_status)?;
        Ok(Response::new(service_to_proto(result)))
    }

    async fn list_my_services(&self, req: Request<AccountIdRequest>) -> Result<Response<ServiceListResponse>, Status> {
        let r = req.into_inner();
        let services = self.service.list_my_services(&r.account_id).await.map_err(to_status)?;
        Ok(Response::new(ServiceListResponse {
            services: services.into_iter().map(service_to_proto).collect(),
        }))
    }

    async fn update_service(&self, req: Request<UpdateServiceRequest>) -> Result<Response<ProtoService>, Status> {
        let r = req.into_inner();
        let result = self.service.update_service(&r.account_id, &r.service_id, r.name.as_deref(), r.duration_minutes, r.price_minor, r.is_active).await.map_err(to_status)?;
        Ok(Response::new(service_to_proto(result)))
    }

    async fn remove_service(&self, req: Request<RemoveServiceRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service.remove_service(&r.account_id, &r.service_id).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn create_availability_rule(&self, req: Request<CreateAvailabilityRuleRequest>) -> Result<Response<ProtoAvailabilityRule>, Status> {
        let r = req.into_inner();
        let result = self.service.create_availability_rule(&r.account_id, &r.weekday, &r.start_time, &r.end_time).await.map_err(to_status)?;
        Ok(Response::new(availability_rule_to_proto(result)))
    }

    async fn list_my_availability_rules(&self, req: Request<AccountIdRequest>) -> Result<Response<AvailabilityRuleListResponse>, Status> {
        let r = req.into_inner();
        let rules = self.service.list_my_availability_rules(&r.account_id).await.map_err(to_status)?;
        Ok(Response::new(AvailabilityRuleListResponse {
            rules: rules.into_iter().map(availability_rule_to_proto).collect(),
        }))
    }

    async fn remove_availability_rule(&self, req: Request<RemoveAvailabilityRuleRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service.remove_availability_rule(&r.account_id, &r.rule_id).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn update_availability_rule(&self, req: Request<UpdateAvailabilityRuleRequest>) -> Result<Response<ProtoAvailabilityRule>, Status> {
        let r = req.into_inner();
        let result = self.service.update_availability_rule(&r.account_id, &r.rule_id, r.weekday.as_deref(), r.start_time.as_deref(), r.end_time.as_deref()).await.map_err(to_status)?;
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
        let appointments = self.service.list_my_appointments(&r.account_id).await.map_err(to_status)?;
        Ok(Response::new(AppointmentListResponse {
            appointments: appointments.into_iter().map(appointment_to_proto).collect(),
        }))
    }

    async fn confirm_appointment(&self, req: Request<ConfirmAppointmentRequest>) -> Result<Response<ProtoAppointment>, Status> {
        let r = req.into_inner();
        let result = self.service.confirm_appointment(&r.account_id, &r.appointment_id).await.map_err(to_status)?;
        Ok(Response::new(appointment_to_proto(result)))
    }

    async fn cancel_appointment(&self, req: Request<CancelAppointmentRequest>) -> Result<Response<ProtoAppointment>, Status> {
        let r = req.into_inner();
        let result = self.service.cancel_appointment(&r.account_id, &r.appointment_id).await.map_err(to_status)?;
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
        let result = self.service.create_public_appointment(&r.slug, &r.service_id, &r.start_time, r.subject_name.as_deref(), r.subject_email.as_deref()).await.map_err(to_status)?;
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
    Server::builder()
        .add_service(BookingApiServiceServer::new(grpc))
        .serve(addr)
        .await?;
    Ok(())
}
