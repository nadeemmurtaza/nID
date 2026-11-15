//! Booking service -- gRPC client for `svc-booking`.
//!
//! Business logic moved to `crates/booking`, served by
//! `services/booking` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::booking::v1::{
    booking_api_service_client::BookingApiServiceClient,
    AccountIdRequest, AppointmentResponse as ProtoAppointment,
    AvailabilityRuleResponse as ProtoAvailabilityRule,
    CreateAvailabilityRuleRequest, CreatePublicAppointmentRequest,
    CreateServiceRequest, FreeSlotResponse as ProtoFreeSlot,
    ServiceResponse as ProtoService, SlugRequest,
    UpdateAvailabilityRuleRequest, UpdateServiceRequest,
    RemoveServiceRequest, RemoveAvailabilityRuleRequest,
    ConfirmAppointmentRequest, CancelAppointmentRequest,
    ComputeFreeSlotsRequest,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::booking::dto::{
    AppointmentResponse, AvailabilityRuleResponse, FreeSlotResponse, ServiceResponse,
};

pub struct BookingService {
    #[allow(dead_code)]
    db: DbPool,
    #[allow(dead_code)]
    env: AppEnv,
}

fn service_from_proto(p: ProtoService) -> ServiceResponse {
    ServiceResponse {
        id: p.id,
        profile_id: p.profile_id,
        name: p.name,
        duration_minutes: p.duration_minutes,
        price_minor: p.price_minor,
        currency: p.currency,
        description: p.description,
        is_active: p.is_active,
    }
}

fn availability_rule_from_proto(p: ProtoAvailabilityRule) -> AvailabilityRuleResponse {
    AvailabilityRuleResponse {
        id: p.id,
        profile_id: p.profile_id,
        weekday: p.weekday,
        start_time: p.start_time,
        end_time: p.end_time,
    }
}

fn appointment_from_proto(p: ProtoAppointment) -> AppointmentResponse {
    AppointmentResponse {
        id: p.id,
        profile_id: p.profile_id,
        service_id: p.service_id,
        start_time: p.start_time,
        end_time: p.end_time,
        status: p.status,
        subject_name: p.subject_name,
        subject_email: p.subject_email,
    }
}

fn free_slot_from_proto(p: ProtoFreeSlot) -> FreeSlotResponse {
    FreeSlotResponse {
        start_time: p.start_time,
        end_time: p.end_time,
        is_available: p.is_available,
    }
}

async fn client() -> Result<BookingApiServiceClient<tonic::transport::Channel>> {
    let url = std::env::var("BOOKING_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:50083".to_string());
    BookingApiServiceClient::connect(url)
        .await
        .map_err(|e| anyhow!("booking service unreachable: {e}"))
}

impl BookingService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn create_service(
        &self,
        account_id: &str,
        req: &crate::modules::booking::dto::CreateServiceRequest,
    ) -> Result<ServiceResponse> {
        let mut c = client().await?;
        let resp = c.create_service(CreateServiceRequest {
            account_id: account_id.to_string(),
            name: req.name.clone(),
            duration_minutes: req.duration_minutes,
            price_minor: req.price_minor,
            currency: req.currency.clone(),
            description: req.description.clone(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(service_from_proto(resp.into_inner()))
    }

    pub async fn list_my_services(&self, account_id: &str) -> Result<Vec<ServiceResponse>> {
        let mut c = client().await?;
        let resp = c.list_my_services(AccountIdRequest {
            account_id: account_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().services.into_iter().map(service_from_proto).collect())
    }

    pub async fn update_service(
        &self,
        account_id: &str,
        service_id: &str,
        req: &crate::modules::booking::dto::UpdateServiceRequest,
    ) -> Result<ServiceResponse> {
        let mut c = client().await?;
        let resp = c.update_service(UpdateServiceRequest {
            account_id: account_id.to_string(),
            service_id: service_id.to_string(),
            name: req.name.clone(),
            duration_minutes: req.duration_minutes,
            price_minor: req.price_minor,
            is_active: req.is_active,
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(service_from_proto(resp.into_inner()))
    }

    pub async fn remove_service(&self, account_id: &str, service_id: &str) -> Result<()> {
        let mut c = client().await?;
        c.remove_service(RemoveServiceRequest {
            account_id: account_id.to_string(),
            service_id: service_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn create_availability_rule(
        &self,
        account_id: &str,
        req: &crate::modules::booking::dto::CreateAvailabilityRuleRequest,
    ) -> Result<AvailabilityRuleResponse> {
        let mut c = client().await?;
        let resp = c.create_availability_rule(CreateAvailabilityRuleRequest {
            account_id: account_id.to_string(),
            weekday: req.weekday.clone(),
            start_time: req.start_time.clone(),
            end_time: req.end_time.clone(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(availability_rule_from_proto(resp.into_inner()))
    }

    pub async fn list_my_availability_rules(&self, account_id: &str) -> Result<Vec<AvailabilityRuleResponse>> {
        let mut c = client().await?;
        let resp = c.list_my_availability_rules(AccountIdRequest {
            account_id: account_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().rules.into_iter().map(availability_rule_from_proto).collect())
    }

    pub async fn remove_availability_rule(&self, account_id: &str, rule_id: &str) -> Result<()> {
        let mut c = client().await?;
        c.remove_availability_rule(RemoveAvailabilityRuleRequest {
            account_id: account_id.to_string(),
            rule_id: rule_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn update_availability_rule(
        &self,
        account_id: &str,
        rule_id: &str,
        req: &crate::modules::booking::dto::UpdateAvailabilityRuleRequest,
    ) -> Result<AvailabilityRuleResponse> {
        let mut c = client().await?;
        let resp = c.update_availability_rule(UpdateAvailabilityRuleRequest {
            account_id: account_id.to_string(),
            rule_id: rule_id.to_string(),
            weekday: req.weekday.clone(),
            start_time: req.start_time.clone(),
            end_time: req.end_time.clone(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(availability_rule_from_proto(resp.into_inner()))
    }

    pub async fn compute_free_slots(
        &self,
        slug: &str,
        service_id: &str,
        from: &str,
        to: &str,
    ) -> Result<Vec<FreeSlotResponse>> {
        let mut c = client().await?;
        let resp = c.compute_free_slots(ComputeFreeSlotsRequest {
            slug: slug.to_string(),
            service_id: service_id.to_string(),
            from: from.to_string(),
            to: to.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().slots.into_iter().map(free_slot_from_proto).collect())
    }

    pub async fn list_my_appointments(&self, account_id: &str) -> Result<Vec<AppointmentResponse>> {
        let mut c = client().await?;
        let resp = c.list_my_appointments(AccountIdRequest {
            account_id: account_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().appointments.into_iter().map(appointment_from_proto).collect())
    }

    pub async fn confirm_appointment(&self, account_id: &str, appointment_id: &str) -> Result<AppointmentResponse> {
        let mut c = client().await?;
        let resp = c.confirm_appointment(ConfirmAppointmentRequest {
            account_id: account_id.to_string(),
            appointment_id: appointment_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(appointment_from_proto(resp.into_inner()))
    }

    pub async fn cancel_appointment(&self, account_id: &str, appointment_id: &str) -> Result<AppointmentResponse> {
        let mut c = client().await?;
        let resp = c.cancel_appointment(CancelAppointmentRequest {
            account_id: account_id.to_string(),
            appointment_id: appointment_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(appointment_from_proto(resp.into_inner()))
    }

    pub async fn list_public_services(&self, slug: &str) -> Result<Vec<ServiceResponse>> {
        let mut c = client().await?;
        let resp = c.list_public_services(SlugRequest {
            slug: slug.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().services.into_iter().map(service_from_proto).collect())
    }

    pub async fn create_public_appointment(
        &self,
        slug: &str,
        req: &crate::modules::booking::dto::CreateAppointmentRequest,
    ) -> Result<AppointmentResponse> {
        let mut c = client().await?;
        let resp = c.create_public_appointment(CreatePublicAppointmentRequest {
            slug: slug.to_string(),
            service_id: req.service_id.clone(),
            start_time: req.start_time.clone(),
            subject_name: req.subject_name.clone(),
            subject_email: req.subject_email.clone(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(appointment_from_proto(resp.into_inner()))
    }
}
