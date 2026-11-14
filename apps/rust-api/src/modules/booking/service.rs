//! Booking service — business logic for booking operations.

use anyhow::{anyhow, Result};
use sqlx::{FromRow, Row};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::booking::dto::{
    AppointmentResponse, AvailabilityRuleResponse, ServiceResponse,
};

pub struct BookingService {
    db: DbPool,
    env: AppEnv,
}

impl BookingService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    // ── Services ──

    pub async fn create_service(
        &self,
        account_id: &str,
        req: &crate::modules::booking::dto::CreateServiceRequest,
    ) -> Result<ServiceResponse> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"));

        if profile_id.is_none() {
            return Err(anyhow!("No profile found for this account"));
        }
        let profile_id = profile_id.unwrap();

        let service: (String, String, String, i32, i64, String, Option<String>, bool) = sqlx::query_as(
            r#"
            INSERT INTO service (id, profile_id, name, duration_minutes, price_minor, currency, description)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
            RETURNING id, profile_id, name, duration_minutes, price_minor, currency, description, is_active
            "#,
        )
        .bind(&profile_id)
        .bind(&req.name)
        .bind(req.duration_minutes)
        .bind(req.price_minor)
        .bind(&req.currency)
        .bind(&req.description)
        .fetch_one(&mut *conn)
        .await?;

        Ok(ServiceResponse {
            id: service.0,
            profile_id: service.1,
            name: service.2,
            duration_minutes: service.3,
            price_minor: service.4,
            currency: service.5,
            description: service.6,
            is_active: service.7,
        })
    }

    pub async fn list_my_services(&self, account_id: &str) -> Result<Vec<ServiceResponse>> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"));

        if profile_id.is_none() {
            return Ok(Vec::new());
        }
        let profile_id = profile_id.unwrap();

        let rows: Vec<(String, String, String, i32, i64, String, Option<String>, bool)> = sqlx::query_as(
            "SELECT id, profile_id, name, duration_minutes, price_minor, currency, description, is_active FROM service WHERE profile_id = $1 ORDER BY name",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| ServiceResponse {
            id: r.0, profile_id: r.1, name: r.2, duration_minutes: r.3,
            price_minor: r.4, currency: r.5, description: r.6, is_active: r.7,
        }).collect())
    }

    pub async fn update_service(
        &self,
        account_id: &str,
        service_id: &str,
        req: &crate::modules::booking::dto::UpdateServiceRequest,
    ) -> Result<ServiceResponse> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"))
        .ok_or_else(|| anyhow!("No profile found"))?;

        let mut sets = Vec::new();
        let mut name_val: Option<String> = None;
        let mut dur_val: Option<i32> = None;
        let mut price_val: Option<i64> = None;
        let mut active_val: Option<bool> = None;

        if let Some(ref n) = req.name {
            sets.push("name = $1");
            name_val = Some(n.clone());
        }
        if req.duration_minutes.is_some() {
            let idx = sets.len() + 1;
            sets.push(&format!("duration_minutes = ${}", idx));
            dur_val = req.duration_minutes;
        }
        if req.price_minor.is_some() {
            let idx = sets.len() + 1;
            sets.push(&format!("price_minor = ${}", idx));
            price_val = req.price_minor;
        }
        if req.is_active.is_some() {
            let idx = sets.len() + 1;
            sets.push(&format!("is_active = ${}", idx));
            active_val = req.is_active;
        }

        if sets.is_empty() {
            return self.get_service(&profile_id, service_id).await;
        }

        let service: (String, String, String, i32, i64, String, Option<String>, bool) = sqlx::query_as(
            &format!(
                "UPDATE service SET {} WHERE id = ${} AND profile_id = ${} RETURNING id, profile_id, name, duration_minutes, price_minor, currency, description, is_active",
                sets.join(", "),
                sets.len() + 1,
                sets.len() + 2,
            ),
        )
        .bind(&name_val)
        .bind(&dur_val)
        .bind(&price_val)
        .bind(&active_val)
        .bind(service_id)
        .bind(&profile_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Service not found"))?;

        Ok(ServiceResponse {
            id: service.0, profile_id: service.1, name: service.2, duration_minutes: service.3,
            price_minor: service.4, currency: service.5, description: service.6, is_active: service.7,
        })
    }

    pub async fn remove_service(&self, account_id: &str, service_id: &str) -> Result<()> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"))
        .ok_or_else(|| anyhow!("No profile found"))?;

        let result = sqlx::query(
            "DELETE FROM service WHERE id = $1 AND profile_id = $2",
        )
        .bind(service_id)
        .bind(&profile_id)
        .execute(&mut *conn)
        .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Service not found."));
        }
        Ok(())
    }

    async fn get_service(&self, profile_id: &str, service_id: &str) -> Result<ServiceResponse> {
        let mut conn = self.db.get().await?;

        let service: (String, String, String, i32, i64, String, Option<String>, bool) = sqlx::query_as(
            "SELECT id, profile_id, name, duration_minutes, price_minor, currency, description, is_active FROM service WHERE id = $1 AND profile_id = $2",
        )
        .bind(service_id)
        .bind(profile_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Service not found"))?;

        Ok(ServiceResponse {
            id: service.0, profile_id: service.1, name: service.2, duration_minutes: service.3,
            price_minor: service.4, currency: service.5, description: service.6, is_active: service.7,
        })
    }

    // ── Availability Rules ──

    pub async fn create_availability_rule(
        &self,
        account_id: &str,
        req: &crate::modules::booking::dto::CreateAvailabilityRuleRequest,
    ) -> Result<AvailabilityRuleResponse> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"))
        .ok_or_else(|| anyhow!("No profile found"))?;

        let rule: (String, String, String, String, String) = sqlx::query_as(
            r#"
            INSERT INTO availability_rule (id, profile_id, weekday, start_time, end_time)
            VALUES (gen_random_uuid(), $1, $2, $3, $4)
            RETURNING id, profile_id, weekday, start_time, end_time
            "#,
        )
        .bind(&profile_id)
        .bind(&req.weekday)
        .bind(&req.start_time)
        .bind(&req.end_time)
        .fetch_one(&mut *conn)
        .await?;

        Ok(AvailabilityRuleResponse {
            id: rule.0, profile_id: rule.1, weekday: rule.2,
            start_time: rule.3, end_time: rule.4,
        })
    }

    pub async fn list_my_availability_rules(&self, account_id: &str) -> Result<Vec<AvailabilityRuleResponse>> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"))
        .ok_or_else(|| anyhow!("No profile found"))?;

        let rows: Vec<(String, String, String, String, String)> = sqlx::query_as(
            "SELECT id, profile_id, weekday, start_time, end_time FROM availability_rule WHERE profile_id = $1 ORDER BY weekday",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| AvailabilityRuleResponse {
            id: r.0, profile_id: r.1, weekday: r.2, start_time: r.3, end_time: r.4,
        }).collect())
    }

    pub async fn remove_availability_rule(&self, account_id: &str, rule_id: &str) -> Result<()> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"))
        .ok_or_else(|| anyhow!("No profile found"))?;

        let result = sqlx::query(
            "DELETE FROM availability_rule WHERE id = $1 AND profile_id = $2",
        )
        .bind(rule_id)
        .bind(&profile_id)
        .execute(&mut *conn)
        .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Availability rule not found."));
        }
        Ok(())
    }

    pub async fn update_availability_rule(
        &self,
        account_id: &str,
        rule_id: &str,
        req: &crate::modules::booking::dto::UpdateAvailabilityRuleRequest,
    ) -> Result<AvailabilityRuleResponse> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"))
        .ok_or_else(|| anyhow!("No profile found"))?;

        let mut sets = Vec::new();
        let mut weekday_val: Option<String> = None;
        let mut start_val: Option<String> = None;
        let mut end_val: Option<String> = None;

        if let Some(ref w) = req.weekday {
            sets.push("weekday = $1");
            weekday_val = Some(w.clone());
        }
        if let Some(ref s) = req.start_time {
            let idx = sets.len() + 1;
            sets.push(&format!("start_time = ${}", idx));
            start_val = Some(s.clone());
        }
        if let Some(ref e) = req.end_time {
            let idx = sets.len() + 1;
            sets.push(&format!("end_time = ${}", idx));
            end_val = Some(e.clone());
        }

        if sets.is_empty() {
            return self.get_availability_rule(&profile_id, rule_id).await;
        }

        let rule: (String, String, String, String, String) = sqlx::query_as(
            &format!(
                "UPDATE availability_rule SET {} WHERE id = ${} AND profile_id = ${} RETURNING id, profile_id, weekday, start_time, end_time",
                sets.join(", "),
                sets.len() + 1,
                sets.len() + 2,
            ),
        )
        .bind(&weekday_val)
        .bind(&start_val)
        .bind(&end_val)
        .bind(rule_id)
        .bind(&profile_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Availability rule not found"))?;

        Ok(AvailabilityRuleResponse {
            id: rule.0, profile_id: rule.1, weekday: rule.2, start_time: rule.3, end_time: rule.4,
        })
    }

    async fn get_availability_rule(&self, profile_id: &str, rule_id: &str) -> Result<AvailabilityRuleResponse> {
        let mut conn = self.db.get().await?;

        let rule: (String, String, String, String, String) = sqlx::query_as(
            "SELECT id, profile_id, weekday, start_time, end_time FROM availability_rule WHERE id = $1 AND profile_id = $2",
        )
        .bind(rule_id)
        .bind(profile_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Availability rule not found"))?;

        Ok(AvailabilityRuleResponse {
            id: rule.0, profile_id: rule.1, weekday: rule.2, start_time: rule.3, end_time: rule.4,
        })
    }

    /// Compute free/busy slots for a service over a date range.
    ///
    /// Mirrors AvailabilityService.computeFreeSlots() in TypeScript.
    /// Returns 30-minute slots between `from` and `to`, marking each as available or booked.
    pub async fn compute_free_slots(
        &self,
        slug: &str,
        service_id: &str,
        from: &str,
        to: &str,
    ) -> Result<Vec<crate::modules::booking::dto::FreeSlotResponse>> {
        let mut conn = self.db.get().await?;

        // Verify profile is published and accepting bookings
        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE slug = $1 AND is_published = true AND show_booking = true LIMIT 1",
        )
        .bind(slug)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"))
        .ok_or_else(|| anyhow!("Profile not accepting bookings"))?;

        // Verify service belongs to this profile
        let duration_minutes: i32 = sqlx::query(
            "SELECT duration_minutes FROM service WHERE id = $1 AND profile_id = $2 AND is_active = true",
        )
        .bind(service_id)
        .bind(&profile_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<i32, _>("duration_minutes"))
        .ok_or_else(|| anyhow!("That service is not available on this profile."))?;

        // Get booked time slots in the range
        let booked: Vec<(String, String)> = sqlx::query_as(
            "SELECT start_time, end_time FROM appointment
             WHERE profile_id = $1 AND service_id = $2 AND status != 'CANCELLED'
             AND start_time < $3 AND end_time > $4
             ORDER BY start_time",
        )
        .bind(&profile_id)
        .bind(service_id)
        .bind(to)
        .bind(from)
        .fetch_all(&mut *conn)
        .await?;

        // Generate 30-minute slots and check against booked appointments
        let from_dt = chrono::DateTime::<chrono::Utc>::parse_from_rfc3339(from)
            .map_err(|_| anyhow!("Invalid 'from' timestamp"))?
            .with_timezone(&chrono::Utc);
        let to_dt = chrono::DateTime::<chrono::Utc>::parse_from_rfc3339(to)
            .map_err(|_| anyhow!("Invalid 'to' timestamp"))?
            .with_timezone(&chrono::Utc);

        let mut slots = Vec::new();
        let mut current = from_dt;
        let slot_duration = chrono::Duration::minutes(30);

        while current + slot_duration <= to_dt {
            let slot_end = current + slot_duration;
            let is_available = booked.iter().all(|(start, end)| {
                let b_start = chrono::DateTime::<chrono::Utc>::parse_from_rfc3339(start)
                    .ok()
                    .map(|d| d.with_timezone(&chrono::Utc))
                    .unwrap_or(current);
                let b_end = chrono::DateTime::<chrono::Utc>::parse_from_rfc3339(end)
                    .ok()
                    .map(|d| d.with_timezone(&chrono::Utc))
                    .unwrap_or(slot_end);
                // Slot is busy if it overlaps with a booked appointment
                !(current >= b_end || slot_end <= b_start)
            }) && booked.iter().all(|(_, _)| true); // Simplified: all slots available if no overlap

            slots.push(crate::modules::booking::dto::FreeSlotResponse {
                start_time: current.to_rfc3339(),
                end_time: slot_end.to_rfc3339(),
                is_available,
            });
            current = slot_end;
        }

        Ok(slots)
    }

    // ── Appointments ──

    pub async fn list_my_appointments(&self, account_id: &str) -> Result<Vec<AppointmentResponse>> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"))
        .ok_or_else(|| anyhow!("No profile found"))?;

        let rows: Vec<(String, String, String, String, String, String, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT id, profile_id, service_id, start_time, end_time, status, subject_name, subject_email FROM appointment WHERE profile_id = $1 ORDER BY start_time DESC",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| AppointmentResponse {
            id: r.0, profile_id: r.1, service_id: r.2,
            start_time: r.3, end_time: r.4, status: r.5,
            subject_name: r.6, subject_email: r.7,
        }).collect())
    }

    pub async fn confirm_appointment(&self, account_id: &str, appointment_id: &str) -> Result<AppointmentResponse> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"))
        .ok_or_else(|| anyhow!("No profile found"))?;

        let appt: (String, String, String, String, String, String, Option<String>, Option<String>) = sqlx::query_as(
            "UPDATE appointment SET status = 'CONFIRMED' WHERE id = $1 AND profile_id = $2 RETURNING id, profile_id, service_id, start_time, end_time, status, subject_name, subject_email",
        )
        .bind(appointment_id)
        .bind(&profile_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Appointment not found"))?;

        Ok(AppointmentResponse {
            id: appt.0, profile_id: appt.1, service_id: appt.2,
            start_time: appt.3, end_time: appt.4, status: appt.5,
            subject_name: appt.6, subject_email: appt.7,
        })
    }

    pub async fn cancel_appointment(&self, account_id: &str, appointment_id: &str) -> Result<AppointmentResponse> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1 LIMIT 1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"))
        .ok_or_else(|| anyhow!("No profile found"))?;

        let appt: (String, String, String, String, String, String, Option<String>, Option<String>) = sqlx::query_as(
            "UPDATE appointment SET status = 'CANCELLED' WHERE id = $1 AND profile_id = $2 RETURNING id, profile_id, service_id, start_time, end_time, status, subject_name, subject_email",
        )
        .bind(appointment_id)
        .bind(&profile_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Appointment not found"))?;

        Ok(AppointmentResponse {
            id: appt.0, profile_id: appt.1, service_id: appt.2,
            start_time: appt.3, end_time: appt.4, status: appt.5,
            subject_name: appt.6, subject_email: appt.7,
        })
    }

    // ── Public endpoints ──

    pub async fn list_public_services(&self, slug: &str) -> Result<Vec<ServiceResponse>> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE slug = $1 AND is_published = true AND show_booking = true LIMIT 1",
        )
        .bind(slug)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"))
        .ok_or_else(|| anyhow!("Profile not accepting bookings"))?;

        let rows: Vec<(String, String, String, i32, i64, String, Option<String>, bool)> = sqlx::query_as(
            "SELECT id, profile_id, name, duration_minutes, price_minor, currency, description, is_active FROM service WHERE profile_id = $1 AND is_active = true ORDER BY name",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| ServiceResponse {
            id: r.0, profile_id: r.1, name: r.2, duration_minutes: r.3,
            price_minor: r.4, currency: r.5, description: r.6, is_active: r.7,
        }).collect())
    }

    pub async fn create_public_appointment(
        &self,
        slug: &str,
        req: &crate::modules::booking::dto::CreateAppointmentRequest,
    ) -> Result<AppointmentResponse> {
        let mut conn = self.db.get().await?;

        let profile_id = sqlx::query(
            "SELECT id FROM profile WHERE slug = $1 AND is_published = true AND show_booking = true LIMIT 1",
        )
        .bind(slug)
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.get::<String, _>("id"))
        .ok_or_else(|| anyhow!("Profile not accepting bookings"))?;

        let appt: (String, String, String, String, String, String, Option<String>, Option<String>) = sqlx::query_as(
            r#"
            INSERT INTO appointment (id, profile_id, service_id, start_time, end_time, status, subject_name, subject_email)
            VALUES (gen_random_uuid(), $1, $2, $3, $3 + ($4 || ' minutes')::interval, 'PENDING', $5, $6)
            RETURNING id, profile_id, service_id, start_time, end_time, status, subject_name, subject_email
            "#,
        )
        .bind(&profile_id)
        .bind(&req.service_id)
        .bind(&req.start_time)
        .bind(60) // placeholder duration
        .bind(&req.subject_name)
        .bind(&req.subject_email)
        .fetch_one(&mut *conn)
        .await?;

        Ok(AppointmentResponse {
            id: appt.0, profile_id: appt.1, service_id: appt.2,
            start_time: appt.3, end_time: appt.4, status: appt.5,
            subject_name: appt.6, subject_email: appt.7,
        })
    }
}
