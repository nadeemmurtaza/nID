//! Subjects service — business logic for subject operations.
//!
//! Mirrors `apps/api/src/modules/subjects/subjects.service.ts`.

use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use deadpool_postgres::Object;
use sqlx::{FromRow, Row};
use tracing::info;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::subjects::dto::{
    AttributeBadgeResponse, AttributeBadgesResponse, BadgeResponse, BadgesResponse,
    SubjectResponse, SubjectType,
};

/// Subject row from database
#[derive(Debug, Clone, FromRow)]
pub struct SubjectRow {
    pub id: String,
    pub tenant_id: String,
    pub external_ref: Option<String>,
    pub r#type: String,
    pub given_name: Option<String>,
    pub family_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub date_of_birth: Option<chrono::DateTime<chrono::Utc>>,
    pub national_id_number: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub region: Option<String>,
    pub country_code: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub account_id: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Approved case evidence for badge ranking
#[derive(Debug, Clone)]
pub struct RankableEvidence {
    pub claim_type: String,
    pub level: String,
    pub verified_at: Option<chrono::DateTime<chrono::Utc>>,
    pub case_id: Option<String>,
}

/// Attribute evidence for attribute badge ranking
#[derive(Debug, Clone)]
pub struct RankableAttributeEvidence {
    pub attribute: String,
    pub level: String,
    pub verified_at: Option<chrono::DateTime<chrono::Utc>>,
    pub case_id: Option<String>,
    pub method: String,
}

/// Subjects service
pub struct SubjectsService {
    db: DbPool,
    env: AppEnv,
}

impl SubjectsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    /// Convert SubjectRow to SubjectResponse
    fn row_to_response(row: SubjectRow) -> SubjectResponse {
        SubjectResponse {
            id: row.id,
            tenant_id: row.tenant_id,
            external_ref: row.external_ref,
            r#type: row.r#type,
            given_name: row.given_name,
            family_name: row.family_name,
            email: row.email,
            phone: row.phone,
            date_of_birth: row.date_of_birth.map(|d| d.to_rfc3339()),
            national_id_number: row.national_id_number,
            address_line1: row.address_line1,
            address_line2: row.address_line2,
            city: row.city,
            region: row.region,
            country_code: row.country_code,
            latitude: row.latitude,
            longitude: row.longitude,
            account_id: row.account_id,
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
        }
    }

    /// Create a new subject
    pub async fn create(
        &self,
        tenant_id: &str,
        api_key_id: &str,
        req: &crate::modules::subjects::dto::CreateSubjectRequest,
    ) -> Result<SubjectResponse> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        let type_str = match &req.r#type {
            SubjectType::Person => "PERSON".to_string(),
            SubjectType::Organization => "ORGANIZATION".to_string(),
        };

        let subject: SubjectRow = sqlx::query_as(
            r#"
            INSERT INTO subject (id, tenant_id, external_ref, type, given_name, family_name, email, phone, date_of_birth, address_line1, address_line2, city, region, country_code, latitude, longitude)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id, tenant_id, external_ref, type, given_name, family_name, email, phone, date_of_birth, national_id_number, address_line1, address_line2, city, region, country_code, latitude, longitude, account_id, created_at, updated_at
            "#,
        )
        .bind(tenant_id)
        .bind(&req.external_ref)
        .bind(type_str)
        .bind(&req.given_name)
        .bind(&req.family_name)
        .bind(&req.email)
        .bind(&req.phone)
        .bind(req.date_of_birth.as_ref().and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok().and_then(|nd| nd.and_time(chrono::LocalTime::MIN).into_owned())))
        .bind(&req.address_line1)
        .bind(&req.address_line2)
        .bind(&req.city)
        .bind(&req.region)
        .bind(&req.country_code)
        .bind(req.latitude)
        .bind(req.longitude)
        .fetch_one(&mut *conn)
        .await?;

        // If phone and date_of_birth are set, create a self-attested PhoneBadgeEvidence
        if subject.phone.is_some() && subject.date_of_birth.is_some() {
            let phone = subject.phone.clone().unwrap();
            sqlx::query(
                r#"
                INSERT INTO phone_badge_evidence (id, phone, tenant_id, subject_id, claim_type, level, verified_at)
                VALUES (gen_random_uuid(), $1, $2, $3, 'DATE_OF_BIRTH', 'SELF_ATTESTED', NULL)
                "#,
            )
            .bind(&phone)
            .bind(tenant_id)
            .bind(&subject.id)
            .execute(&mut *conn)
            .await?;
        }

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, subject_id, metadata)
            VALUES (gen_random_uuid(), $1, 'API_KEY', $2, 'subject.create', $3, NULL)
            "#,
        )
        .bind(tenant_id)
        .bind(api_key_id)
        .bind(&subject.id)
        .execute(&mut *conn)
        .await?;

        Ok(Self::row_to_response(subject))
    }

    /// Get subject by ID
    pub async fn get_by_id(&self, tenant_id: &str, api_key_id: &str, subject_id: &str) -> Result<SubjectResponse> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        let subject: SubjectRow = sqlx::query_as(
            "SELECT id, tenant_id, external_ref, type, given_name, family_name, email, phone, date_of_birth, national_id_number, address_line1, address_line2, city, region, country_code, latitude, longitude, account_id, created_at, updated_at FROM subject WHERE id = $1",
        )
        .bind(subject_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Subject not found"))?;

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, subject_id, metadata)
            VALUES (gen_random_uuid(), $1, 'API_KEY', $2, 'subject.read', $3, NULL)
            "#,
        )
        .bind(tenant_id)
        .bind(api_key_id)
        .bind(&subject.id)
        .execute(&mut *conn)
        .await?;

        Ok(Self::row_to_response(subject))
    }

    /// Get badges for a subject — one badge per ClaimType (strongest APPROVED case)
    pub async fn get_badges(
        &self,
        tenant_id: &str,
        actor_type: &str,
        actor_id: &str,
        subject_id: &str,
    ) -> Result<BadgesResponse> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        // Verify subject exists
        let subject: SubjectRow = sqlx::query_as(
            "SELECT id, tenant_id, external_ref, type, given_name, family_name, email, phone, date_of_birth, national_id_number, address_line1, address_line2, city, region, country_code, latitude, longitude, account_id, created_at, updated_at FROM subject WHERE id = $1",
        )
        .bind(subject_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Subject not found"))?;

        // Get all APPROVED cases ordered by level DESC (strongest first)
        let rows = sqlx::query(
            "SELECT id, claim_type, level, resolved_at FROM verification_case WHERE subject_id = $1 AND status = 'APPROVED' ORDER BY level DESC, resolved_at DESC",
        )
        .bind(subject_id)
        .fetch_all(&mut *conn)
        .await?;

        let mut evidence: Vec<RankableEvidence> = rows
            .into_iter()
            .map(|row| RankableEvidence {
                claim_type: row.get::<String, _>("claim_type"),
                level: row.get::<String, _>("level"),
                verified_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("resolved_at"),
                case_id: Some(row.get::<String, _>("id")),
            })
            .collect();

        // Append self-attested DATE_OF_BIRTH if subject has date_of_birth but no APPROVED case for it
        if subject.date_of_birth.is_some() {
            evidence.push(RankableEvidence {
                claim_type: "DATE_OF_BIRTH".to_string(),
                level: "SELF_ATTESTED".to_string(),
                verified_at: None,
                case_id: None,
            });
        }

        // Pick strongest per claim type (first occurrence wins since we sorted DESC)
        let mut seen = std::collections::HashSet::new();
        let badges: Vec<BadgeResponse> = evidence
            .into_iter()
            .filter(|e| seen.insert(e.claim_type.clone()))
            .map(|e| BadgeResponse {
                claim_type: e.claim_type,
                level: e.level,
                verified_at: e.verified_at.map(|d| d.to_rfc3339()),
                case_id: e.case_id,
            })
            .collect();

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, subject_id, metadata)
            VALUES (gen_random_uuid(), $1, $2, $3, 'subject.badges_read', $4, NULL)
            "#,
        )
        .bind(tenant_id)
        .bind(actor_type)
        .bind(actor_id)
        .bind(&subject.id)
        .execute(&mut *conn)
        .await?;

        Ok(BadgesResponse {
            subject_id: subject.id,
            badges,
        })
    }

    /// Get attribute badges for a subject — one badge per AttributeType
    pub async fn get_attribute_badges(
        &self,
        tenant_id: &str,
        actor_type: &str,
        actor_id: &str,
        subject_id: &str,
    ) -> Result<AttributeBadgesResponse> {
        let conn = self.db.get().await?;

        // Set tenant context for RLS
        sqlx::query("SET app.tenant_id = $1")
            .bind(tenant_id)
            .execute(&mut *conn)
            .await?;

        // Verify subject exists
        let subject: SubjectRow = sqlx::query_as(
            "SELECT id, tenant_id, external_ref, type, given_name, family_name, email, phone, date_of_birth, national_id_number, address_line1, address_line2, city, region, country_code, latitude, longitude, account_id, created_at, updated_at FROM subject WHERE id = $1",
        )
        .bind(subject_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Subject not found"))?;

        // Get all verified attributes ordered by level DESC (strongest first)
        let rows = sqlx::query(
            "SELECT attribute, level, verified_at, case_id, method FROM verified_attribute WHERE subject_id = $1 ORDER BY level DESC, verified_at DESC",
        )
        .bind(subject_id)
        .fetch_all(&mut *conn)
        .await?;

        let evidence: Vec<RankableAttributeEvidence> = rows
            .into_iter()
            .map(|row| RankableAttributeEvidence {
                attribute: row.get::<String, _>("attribute"),
                level: row.get::<String, _>("level"),
                verified_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("verified_at"),
                case_id: Some(row.get::<String, _>("case_id")),
                method: row.get::<String, _>("method"),
            })
            .collect();

        // Pick strongest per attribute (first occurrence wins since we sorted DESC)
        let mut seen = std::collections::HashSet::new();
        let badges: Vec<AttributeBadgeResponse> = evidence
            .into_iter()
            .filter(|e| seen.insert(e.attribute.clone()))
            .map(|e| AttributeBadgeResponse {
                attribute: e.attribute,
                level: e.level,
                verified_at: e.verified_at.map(|d| d.to_rfc3339()),
                case_id: e.case_id,
                method: e.method,
            })
            .collect();

        // Audit log
        sqlx::query(
            r#"
            INSERT INTO audit_log_entry (id, tenant_id, actor_type, actor_id, action, subject_id, metadata)
            VALUES (gen_random_uuid(), $1, $2, $3, 'subject.attribute_badges_read', $4, NULL)
            "#,
        )
        .bind(tenant_id)
        .bind(actor_type)
        .bind(actor_id)
        .bind(&subject.id)
        .execute(&mut *conn)
        .await?;

        Ok(AttributeBadgesResponse {
            subject_id: subject.id,
            badges,
        })
    }
}
