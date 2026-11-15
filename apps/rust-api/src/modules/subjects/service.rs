//! Subjects service -- gRPC client for `svc-subjects`.
//!
//! Business logic moved to `crates/subjects`, served by `services/subjects`
//! (see CONVENTIONS.md's crates/services split). Same public shape so
//! `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::subjects::v1::{
    subjects_service_client::SubjectsServiceClient, CreateRequest as GrpcCreateRequest, GetBadgesRequest, GetByIdRequest,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::subjects::dto::{
    AttributeBadgeResponse, AttributeBadgesResponse, BadgeResponse, BadgesResponse, CreateSubjectRequest, SubjectResponse,
    SubjectType,
};

pub struct SubjectsService {
    #[allow(dead_code)]
    db: DbPool,
    #[allow(dead_code)]
    env: AppEnv,
}

fn subject_from_proto(s: newax_proto::subjects::v1::SubjectResponse) -> SubjectResponse {
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

fn badges_from_proto(b: newax_proto::subjects::v1::BadgesResponse) -> BadgesResponse {
    BadgesResponse {
        subject_id: b.subject_id,
        badges: b
            .badges
            .into_iter()
            .map(|e| BadgeResponse { claim_type: e.claim_type, level: e.level, verified_at: e.verified_at, case_id: e.case_id })
            .collect(),
    }
}

fn attribute_badges_from_proto(b: newax_proto::subjects::v1::AttributeBadgesResponse) -> AttributeBadgesResponse {
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

async fn client() -> Result<SubjectsServiceClient<tonic::transport::Channel>> {
    let url = std::env::var("SUBJECTS_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:50077".to_string());
    SubjectsServiceClient::connect(url).await.map_err(|e| anyhow!("subjects service unreachable: {e}"))
}

impl SubjectsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn create(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        req: &CreateSubjectRequest,
    ) -> Result<SubjectResponse> {
        let mut c = client().await?;
        let type_str = match &req.r#type {
            SubjectType::Person => "PERSON".to_string(),
            SubjectType::Organization => "ORGANIZATION".to_string(),
        };
        let resp = c
            .create(GrpcCreateRequest {
                tenant_id: tenant_id.to_string(),
                api_key_id: api_key_id.to_string(),
                r#type: type_str,
                external_ref: req.external_ref.clone(),
                given_name: req.given_name.clone(),
                family_name: req.family_name.clone(),
                email: req.email.clone(),
                phone: req.phone.clone(),
                date_of_birth: req.date_of_birth.clone(),
                address_line1: req.address_line1.clone(),
                address_line2: req.address_line2.clone(),
                city: req.city.clone(),
                region: req.region.clone(),
                country_code: req.country_code.clone(),
                latitude: req.latitude,
                longitude: req.longitude,
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(subject_from_proto(resp.into_inner()))
    }

    pub async fn get_by_id(&self, tenant_id: &str, api_key_id: &str, subject_id: &str) -> Result<SubjectResponse> {
        let mut c = client().await?;
        let resp = c
            .get_by_id(GetByIdRequest {
                tenant_id: tenant_id.to_string(),
                api_key_id: api_key_id.to_string(),
                subject_id: subject_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(subject_from_proto(resp.into_inner()))
    }

    pub async fn get_badges(
        &self,
        tenant_id: &str,
        actor_type: &str,
        actor_id: &str,
        subject_id: &str,
    ) -> Result<BadgesResponse> {
        let mut c = client().await?;
        let resp = c
            .get_badges(GetBadgesRequest {
                tenant_id: tenant_id.to_string(),
                actor_type: actor_type.to_string(),
                actor_id: actor_id.to_string(),
                subject_id: subject_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(badges_from_proto(resp.into_inner()))
    }

    pub async fn get_attribute_badges(
        &self,
        tenant_id: &str,
        actor_type: &str,
        actor_id: &str,
        subject_id: &str,
    ) -> Result<AttributeBadgesResponse> {
        let mut c = client().await?;
        let resp = c
            .get_attribute_badges(GetBadgesRequest {
                tenant_id: tenant_id.to_string(),
                actor_type: actor_type.to_string(),
                actor_id: actor_id.to_string(),
                subject_id: subject_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(attribute_badges_from_proto(resp.into_inner()))
    }
}
