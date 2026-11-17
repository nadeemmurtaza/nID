//! Booking service: services, availability rules and appointments.
//!
//! Extracted from `apps/rust-api/src/modules/booking/service.rs` as part of
//! CONVENTIONS.md's crates/services split. Takes a plain `sqlx::PgPool`
//! rather than nID's `core::db::DbPool` wrapper.
//!
//! The behaviour mirrors the TypeScript reference in
//! `apps/api/src/modules/booking`: availability is recurring weekly rules in
//! minutes-from-midnight local to the profile's timezone, slots are cut at
//! the service duration, and a booking is rejected if it falls outside the
//! rules or overlaps a PENDING/CONFIRMED appointment.

use anyhow::{anyhow, Result};
use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use sqlx::PgPool;

const WEEKDAYS: [&str; 7] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const MAX_RANGE_DAYS: i64 = 31;
const MAX_BOOKING_ATTEMPTS: u32 = 3;

#[derive(Debug, Clone)]
pub struct ServiceResponse {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub description: Option<String>,
    pub duration_minutes: i32,
    pub price: Option<f64>,
    pub currency: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone)]
pub struct AvailabilityRuleResponse {
    pub id: String,
    pub profile_id: String,
    pub day: String,
    pub start_minute: i32,
    pub end_minute: i32,
    pub is_active: bool,
}

#[derive(Debug, Clone)]
pub struct AppointmentResponse {
    pub id: String,
    pub profile_id: String,
    pub service_id: String,
    pub starts_at: String,
    pub ends_at: String,
    pub status: String,
    pub visitor_name: String,
    pub visitor_phone: Option<String>,
    pub visitor_email: Option<String>,
    pub notes: Option<String>,
    pub service_name: Option<String>,
}

#[derive(Debug, Clone)]
pub struct FreeSlotResponse {
    pub starts_at: String,
    pub ends_at: String,
}

type ServiceRow = (String, String, String, Option<String>, i32, Option<f64>, Option<String>, bool);
type RuleRow = (String, String, String, i32, i32, bool);
type AppointmentRow = (
    String,
    String,
    String,
    DateTime<Utc>,
    DateTime<Utc>,
    String,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
);

fn iso(d: DateTime<Utc>) -> String {
    d.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn service_from(r: ServiceRow) -> ServiceResponse {
    ServiceResponse {
        id: r.0,
        profile_id: r.1,
        name: r.2,
        description: r.3,
        duration_minutes: r.4,
        price: r.5,
        currency: r.6,
        is_active: r.7,
    }
}

fn rule_from(r: RuleRow) -> AvailabilityRuleResponse {
    AvailabilityRuleResponse { id: r.0, profile_id: r.1, day: r.2, start_minute: r.3, end_minute: r.4, is_active: r.5 }
}

fn appointment_from(r: AppointmentRow) -> AppointmentResponse {
    AppointmentResponse {
        id: r.0,
        profile_id: r.1,
        service_id: r.2,
        starts_at: iso(r.3),
        ends_at: iso(r.4),
        status: r.5,
        visitor_name: r.6,
        visitor_phone: r.7,
        visitor_email: r.8,
        notes: r.9,
        service_name: r.10,
    }
}

fn normalise_day(day: &str) -> Result<String> {
    let up = day.trim().to_uppercase();
    if WEEKDAYS.contains(&up.as_str()) {
        Ok(up)
    } else {
        Err(anyhow!("Invalid day: use MONDAY to SUNDAY"))
    }
}

fn check_window(start_minute: i32, end_minute: i32) -> Result<()> {
    if !(0..=1439).contains(&start_minute) || !(1..=1440).contains(&end_minute) {
        return Err(anyhow!("Invalid window: minutes must be between 0 and 1440"));
    }
    if end_minute <= start_minute {
        return Err(anyhow!("Invalid window: endMinute must be after startMinute"));
    }
    Ok(())
}

fn check_len(field: &str, value: &str, min: usize, max: usize) -> Result<()> {
    let n = value.trim().chars().count();
    if n < min || n > max {
        return Err(anyhow!("Invalid {field}: must be between {min} and {max} characters"));
    }
    Ok(())
}

fn parse_date(label: &str, value: &str) -> Result<NaiveDate> {
    let head: String = value.chars().take(10).collect();
    NaiveDate::parse_from_str(&head, "%Y-%m-%d").map_err(|_| anyhow!("Invalid {label}: use a YYYY-MM-DD date"))
}

fn is_serialization_failure(err: &anyhow::Error) -> bool {
    err.downcast_ref::<sqlx::Error>()
        .and_then(|e| e.as_database_error())
        .and_then(|d| d.code())
        .map(|c| c == "40001" || c == "40P01")
        .unwrap_or(false)
}

/// Which profile a "my services/hours/appointments/..." call should
/// resolve to -- a person's own (personal) profile, or a work profile
/// owned by an organization they administer. Both are plain rows in the
/// same `profile` table (Profile.accountId XOR Profile.organizationId,
/// see schema.prisma's own comment on that), so every CRUD query below
/// is identical either way once resolve_profile_id() has found the row;
/// only *which* row is found differs.
pub enum ProfileOwner<'a> {
    Account(&'a str),
    /// (caller_account_id, organization_id) -- the caller must be an
    /// ACTIVE admin member of a KYB-verified organization to manage its
    /// profile's content, the same bar OrganizationProfilesService sets
    /// for the profile itself.
    Organization(&'a str, &'a str),
}

pub struct BookingService {
    db: PgPool,
}

impl BookingService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    async fn resolve_profile_id(&self, owner: &ProfileOwner<'_>) -> Result<String> {
        match owner {
            ProfileOwner::Account(account_id) => sqlx::query_scalar("SELECT id FROM profile WHERE account_id = $1 LIMIT 1")
                .bind(account_id)
                .fetch_optional(&self.db)
                .await?
                .ok_or_else(|| anyhow!("No profile found")),
            ProfileOwner::Organization(caller_account_id, organization_id) => {
                // A transaction, not a plain pooled connection: set_config(...,
                // true) is transaction-local, so without one each statement
                // below runs as its own autocommit transaction and the
                // tenant_id set here would already be gone by the next query.
                let mut tx = self.db.begin().await?;

                let (org_tenant, org_subject): (String, String) =
                    sqlx::query_as("SELECT tenant_id, subject_id FROM organization WHERE id = $1")
                        .bind(organization_id)
                        .fetch_optional(&mut *tx)
                        .await?
                        .ok_or_else(|| anyhow!("Organization not found"))?;

                sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
                    .bind(&org_tenant)
                    .execute(&mut *tx)
                    .await?;

                let verified: bool = sqlx::query_scalar(
                    "SELECT EXISTS(SELECT 1 FROM verification_case WHERE subject_id = $1 AND status = 'APPROVED' AND claim_type = 'IDENTITY')",
                )
                .bind(&org_subject)
                .fetch_one(&mut *tx)
                .await?;
                if !verified {
                    return Err(anyhow!("Organization must be verified to manage its profile's content."));
                }

                let membership: Option<(String, bool)> = sqlx::query_as(
                    "SELECT status, is_admin FROM organization_membership WHERE organization_id = $1 AND account_id = $2",
                )
                .bind(organization_id)
                .bind(caller_account_id)
                .fetch_optional(&mut *tx)
                .await?;
                match membership {
                    Some((status, true)) if status == "ACTIVE" => {}
                    _ => return Err(anyhow!("You are not authorized to manage this organization's profile.")),
                }

                sqlx::query_scalar("SELECT id FROM profile WHERE organization_id = $1 LIMIT 1")
                    .bind(organization_id)
                    .fetch_optional(&mut *tx)
                    .await?
                    .ok_or_else(|| anyhow!("This organization has no public profile yet."))
            }
        }
    }

    /// Profile id and IANA timezone of a published profile that takes bookings.
    async fn get_bookable_profile(&self, slug: &str) -> Result<(String, String)> {
        sqlx::query_as(
            "SELECT id, COALESCE(timezone, 'UTC') FROM profile WHERE slug = $1 AND is_published = true AND show_booking = true LIMIT 1",
        )
        .bind(slug)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow!("Profile not accepting bookings"))
    }

    // ── Services ──

    pub async fn create_service(
        &self,
        owner: &ProfileOwner<'_>,
        name: &str,
        duration_minutes: i32,
        price: Option<f64>,
        currency: Option<&str>,
        description: Option<&str>,
        is_active: Option<bool>,
    ) -> Result<ServiceResponse> {
        check_len("name", name, 1, 120)?;
        if !(5..=1440).contains(&duration_minutes) {
            return Err(anyhow!("Invalid duration: must be between 5 and 1440 minutes"));
        }
        if price.is_some_and(|p| !p.is_finite() || p < 0.0) {
            return Err(anyhow!("Invalid price: must be zero or more"));
        }
        if let Some(c) = currency {
            check_len("currency", c, 1, 8)?;
        }
        if let Some(d) = description {
            check_len("description", d, 0, 2000)?;
        }
        let profile_id = self.resolve_profile_id(owner).await?;

        let row: ServiceRow = sqlx::query_as(
            r#"
            INSERT INTO service (id, profile_id, name, description, duration_minutes, price, currency, is_active)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, COALESCE($7, true))
            RETURNING id, profile_id, name, description, duration_minutes, price, currency, is_active
            "#,
        )
        .bind(&profile_id)
        .bind(name.trim())
        .bind(description)
        .bind(duration_minutes)
        .bind(price)
        .bind(currency)
        .bind(is_active)
        .fetch_one(&self.db)
        .await?;
        Ok(service_from(row))
    }

    pub async fn list_my_services(&self, owner: &ProfileOwner<'_>) -> Result<Vec<ServiceResponse>> {
        let profile_id = self.resolve_profile_id(owner).await?;
        let rows: Vec<ServiceRow> = sqlx::query_as(
            "SELECT id, profile_id, name, description, duration_minutes, price, currency, is_active FROM service WHERE profile_id = $1 ORDER BY name",
        )
        .bind(&profile_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows.into_iter().map(service_from).collect())
    }

    pub async fn update_service(
        &self,
        owner: &ProfileOwner<'_>,
        service_id: &str,
        name: Option<&str>,
        duration_minutes: Option<i32>,
        price: Option<f64>,
        is_active: Option<bool>,
        description: Option<&str>,
        currency: Option<&str>,
    ) -> Result<ServiceResponse> {
        if let Some(n) = name {
            check_len("name", n, 1, 120)?;
        }
        if duration_minutes.is_some_and(|d| !(5..=1440).contains(&d)) {
            return Err(anyhow!("Invalid duration: must be between 5 and 1440 minutes"));
        }
        if price.is_some_and(|p| !p.is_finite() || p < 0.0) {
            return Err(anyhow!("Invalid price: must be zero or more"));
        }
        if let Some(c) = currency {
            check_len("currency", c, 1, 8)?;
        }
        if let Some(d) = description {
            check_len("description", d, 0, 2000)?;
        }
        let profile_id = self.resolve_profile_id(owner).await?;

        let row: Option<ServiceRow> = sqlx::query_as(
            r#"
            UPDATE service SET
                name = COALESCE($3, name),
                description = COALESCE($4, description),
                duration_minutes = COALESCE($5, duration_minutes),
                price = COALESCE($6, price),
                currency = COALESCE($7, currency),
                is_active = COALESCE($8, is_active),
                updated_at = NOW()
            WHERE id = $1 AND profile_id = $2
            RETURNING id, profile_id, name, description, duration_minutes, price, currency, is_active
            "#,
        )
        .bind(service_id)
        .bind(&profile_id)
        .bind(name.map(str::trim))
        .bind(description)
        .bind(duration_minutes)
        .bind(price)
        .bind(currency)
        .bind(is_active)
        .fetch_optional(&self.db)
        .await?;
        row.map(service_from).ok_or_else(|| anyhow!("Service not found"))
    }

    pub async fn remove_service(&self, owner: &ProfileOwner<'_>, service_id: &str) -> Result<()> {
        let profile_id = self.resolve_profile_id(owner).await?;
        let result = sqlx::query("DELETE FROM service WHERE id = $1 AND profile_id = $2")
            .bind(service_id)
            .bind(&profile_id)
            .execute(&self.db)
            .await?;
        if result.rows_affected() == 0 {
            return Err(anyhow!("Service not found."));
        }
        Ok(())
    }

    // ── Availability rules ──

    pub async fn create_availability_rule(
        &self,
        owner: &ProfileOwner<'_>,
        day: &str,
        start_minute: i32,
        end_minute: i32,
        is_active: Option<bool>,
    ) -> Result<AvailabilityRuleResponse> {
        let day = normalise_day(day)?;
        check_window(start_minute, end_minute)?;
        let profile_id = self.resolve_profile_id(owner).await?;

        let row: RuleRow = sqlx::query_as(
            r#"
            INSERT INTO availability_rule (id, profile_id, day, start_minute, end_minute, is_active)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, COALESCE($5, true))
            RETURNING id, profile_id, day, start_minute, end_minute, is_active
            "#,
        )
        .bind(&profile_id)
        .bind(&day)
        .bind(start_minute)
        .bind(end_minute)
        .bind(is_active)
        .fetch_one(&self.db)
        .await?;
        Ok(rule_from(row))
    }

    pub async fn list_my_availability_rules(&self, owner: &ProfileOwner<'_>) -> Result<Vec<AvailabilityRuleResponse>> {
        let profile_id = self.resolve_profile_id(owner).await?;
        let rows: Vec<RuleRow> = sqlx::query_as(
            r#"
            SELECT id, profile_id, day, start_minute, end_minute, is_active
            FROM availability_rule WHERE profile_id = $1
            ORDER BY CASE day
                WHEN 'MONDAY' THEN 1 WHEN 'TUESDAY' THEN 2 WHEN 'WEDNESDAY' THEN 3 WHEN 'THURSDAY' THEN 4
                WHEN 'FRIDAY' THEN 5 WHEN 'SATURDAY' THEN 6 ELSE 7 END, start_minute
            "#,
        )
        .bind(&profile_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows.into_iter().map(rule_from).collect())
    }

    pub async fn remove_availability_rule(&self, owner: &ProfileOwner<'_>, rule_id: &str) -> Result<()> {
        let profile_id = self.resolve_profile_id(owner).await?;
        let result = sqlx::query("DELETE FROM availability_rule WHERE id = $1 AND profile_id = $2")
            .bind(rule_id)
            .bind(&profile_id)
            .execute(&self.db)
            .await?;
        if result.rows_affected() == 0 {
            return Err(anyhow!("Availability rule not found."));
        }
        Ok(())
    }

    pub async fn update_availability_rule(
        &self,
        owner: &ProfileOwner<'_>,
        rule_id: &str,
        day: Option<&str>,
        start_minute: Option<i32>,
        end_minute: Option<i32>,
        is_active: Option<bool>,
    ) -> Result<AvailabilityRuleResponse> {
        let profile_id = self.resolve_profile_id(owner).await?;
        let day = day.map(normalise_day).transpose()?;

        let existing: Option<(i32, i32)> = sqlx::query_as(
            "SELECT start_minute, end_minute FROM availability_rule WHERE id = $1 AND profile_id = $2",
        )
        .bind(rule_id)
        .bind(&profile_id)
        .fetch_optional(&self.db)
        .await?;
        let (cur_start, cur_end) = existing.ok_or_else(|| anyhow!("Availability rule not found"))?;
        check_window(start_minute.unwrap_or(cur_start), end_minute.unwrap_or(cur_end))?;

        let row: Option<RuleRow> = sqlx::query_as(
            r#"
            UPDATE availability_rule SET
                day = COALESCE($3, day),
                start_minute = COALESCE($4, start_minute),
                end_minute = COALESCE($5, end_minute),
                is_active = COALESCE($6, is_active)
            WHERE id = $1 AND profile_id = $2
            RETURNING id, profile_id, day, start_minute, end_minute, is_active
            "#,
        )
        .bind(rule_id)
        .bind(&profile_id)
        .bind(day)
        .bind(start_minute)
        .bind(end_minute)
        .bind(is_active)
        .fetch_optional(&self.db)
        .await?;
        row.map(rule_from).ok_or_else(|| anyhow!("Availability rule not found"))
    }

    /// Open slots for a service between two calendar dates (inclusive): the
    /// profile's active rules for each weekday, cut at the service duration in
    /// the profile's timezone, minus anything that overlaps a PENDING or
    /// CONFIRMED appointment and anything already in the past.
    pub async fn compute_free_slots(
        &self,
        slug: &str,
        service_id: &str,
        from: &str,
        to: &str,
    ) -> Result<Vec<FreeSlotResponse>> {
        let from_date = parse_date("from", from)?;
        let to_date = parse_date("to", to)?;
        if to_date < from_date {
            return Err(anyhow!("Invalid range: 'to' must not be before 'from'"));
        }
        if (to_date - from_date).num_days() + 1 > MAX_RANGE_DAYS {
            return Err(anyhow!("Invalid range: cannot exceed {MAX_RANGE_DAYS} days"));
        }
        let (profile_id, timezone) = self.get_bookable_profile(slug).await?;

        let duration_minutes: i32 = sqlx::query_scalar(
            "SELECT duration_minutes FROM service WHERE id = $1 AND profile_id = $2 AND is_active = true",
        )
        .bind(service_id)
        .bind(&profile_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow!("That service was not found on this profile."))?;

        let rows: Vec<(DateTime<Utc>, DateTime<Utc>)> = sqlx::query_as(
            r#"
            SELECT DISTINCT s.starts_at, s.starts_at + make_interval(mins => $5::int) AS ends_at
            FROM (
                SELECT ((d.day + make_interval(mins => m.minute))::timestamp AT TIME ZONE $2) AS starts_at
                FROM generate_series($3::date::timestamp, $4::date::timestamp, interval '1 day') AS d(day)
                JOIN availability_rule r
                  ON r.profile_id = $1 AND r.is_active = true
                 AND r.day = (ARRAY['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'])[extract(dow FROM d.day)::int + 1]
                CROSS JOIN LATERAL generate_series(r.start_minute, r.end_minute - $5::int, $5::int) AS m(minute)
            ) s
            WHERE s.starts_at > NOW()
              AND NOT EXISTS (
                  SELECT 1 FROM appointment a
                  WHERE a.profile_id = $1 AND a.status IN ('PENDING', 'CONFIRMED')
                    AND a.starts_at < s.starts_at + make_interval(mins => $5::int)
                    AND a.ends_at > s.starts_at
              )
            ORDER BY s.starts_at
            "#,
        )
        .bind(&profile_id)
        .bind(&timezone)
        .bind(from_date)
        .bind(to_date)
        .bind(duration_minutes)
        .fetch_all(&self.db)
        .await?;

        Ok(rows.into_iter().map(|(s, e)| FreeSlotResponse { starts_at: iso(s), ends_at: iso(e) }).collect())
    }

    // ── Appointments ──

    async fn get_appointment(&self, profile_id: &str, appointment_id: &str) -> Result<AppointmentResponse> {
        let row: Option<AppointmentRow> = sqlx::query_as(
            r#"
            SELECT a.id, a.profile_id, a.service_id, a.starts_at, a.ends_at, a.status, a.visitor_name,
                   a.visitor_phone, a.visitor_email, a.notes, s.name
            FROM appointment a LEFT JOIN service s ON s.id = a.service_id
            WHERE a.id = $1 AND a.profile_id = $2
            "#,
        )
        .bind(appointment_id)
        .bind(profile_id)
        .fetch_optional(&self.db)
        .await?;
        row.map(appointment_from).ok_or_else(|| anyhow!("Appointment not found"))
    }

    pub async fn list_my_appointments(&self, owner: &ProfileOwner<'_>) -> Result<Vec<AppointmentResponse>> {
        let profile_id = self.resolve_profile_id(owner).await?;
        let rows: Vec<AppointmentRow> = sqlx::query_as(
            r#"
            SELECT a.id, a.profile_id, a.service_id, a.starts_at, a.ends_at, a.status, a.visitor_name,
                   a.visitor_phone, a.visitor_email, a.notes, s.name
            FROM appointment a LEFT JOIN service s ON s.id = a.service_id
            WHERE a.profile_id = $1
            ORDER BY a.starts_at DESC
            "#,
        )
        .bind(&profile_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows.into_iter().map(appointment_from).collect())
    }

    /// Move an appointment from one of `from_statuses` to `to_status`, or say
    /// why it cannot (not found vs already past that state).
    async fn transition(
        &self,
        owner: &ProfileOwner<'_>,
        appointment_id: &str,
        from_statuses: &[&str],
        to_status: &str,
    ) -> Result<AppointmentResponse> {
        let profile_id = self.resolve_profile_id(owner).await?;
        let from: Vec<String> = from_statuses.iter().map(|s| s.to_string()).collect();

        let updated: Option<String> = sqlx::query_scalar(
            r#"
            UPDATE appointment SET status = $3, updated_at = NOW()
            WHERE id = $1 AND profile_id = $2 AND status = ANY($4)
            RETURNING id
            "#,
        )
        .bind(appointment_id)
        .bind(&profile_id)
        .bind(to_status)
        .bind(&from)
        .fetch_optional(&self.db)
        .await?;

        if updated.is_none() {
            let current: Option<String> = sqlx::query_scalar(
                "SELECT status FROM appointment WHERE id = $1 AND profile_id = $2",
            )
            .bind(appointment_id)
            .bind(&profile_id)
            .fetch_optional(&self.db)
            .await?;
            return match current {
                None => Err(anyhow!("Appointment not found")),
                Some(s) => Err(anyhow!("Appointment is already {s}, so it cannot become {to_status}.")),
            };
        }
        self.get_appointment(&profile_id, appointment_id).await
    }

    pub async fn confirm_appointment(&self, owner: &ProfileOwner<'_>, appointment_id: &str) -> Result<AppointmentResponse> {
        self.transition(owner, appointment_id, &["PENDING"], "CONFIRMED").await
    }

    pub async fn cancel_appointment(&self, owner: &ProfileOwner<'_>, appointment_id: &str) -> Result<AppointmentResponse> {
        self.transition(owner, appointment_id, &["PENDING", "CONFIRMED"], "CANCELLED").await
    }

    // ── Public endpoints ──

    pub async fn list_public_services(&self, slug: &str) -> Result<Vec<ServiceResponse>> {
        let (profile_id, _) = self.get_bookable_profile(slug).await?;
        let rows: Vec<ServiceRow> = sqlx::query_as(
            "SELECT id, profile_id, name, description, duration_minutes, price, currency, is_active FROM service WHERE profile_id = $1 AND is_active = true ORDER BY name",
        )
        .bind(&profile_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows.into_iter().map(service_from).collect())
    }

    pub async fn create_public_appointment(
        &self,
        slug: &str,
        service_id: &str,
        starts_at: &str,
        visitor_name: &str,
        visitor_phone: Option<&str>,
        visitor_email: Option<&str>,
        notes: Option<&str>,
    ) -> Result<AppointmentResponse> {
        check_len("visitorName", visitor_name, 1, 120)?;
        if let Some(p) = visitor_phone {
            check_len("visitorPhone", p, 0, 32)?;
        }
        if let Some(e) = visitor_email {
            if !e.contains('@') || e.len() > 254 {
                return Err(anyhow!("Invalid visitorEmail: must be a valid address"));
            }
        }
        if let Some(n) = notes {
            check_len("notes", n, 0, 1000)?;
        }
        let starts: DateTime<Utc> = DateTime::parse_from_rfc3339(starts_at)
            .map_err(|_| anyhow!("Invalid startsAt: use an ISO 8601 timestamp"))?
            .with_timezone(&Utc);
        if starts <= Utc::now() {
            return Err(anyhow!("Invalid startsAt: must be in the future"));
        }

        let (profile_id, timezone) = self.get_bookable_profile(slug).await?;
        let duration_minutes: i32 = sqlx::query_scalar(
            "SELECT duration_minutes FROM service WHERE id = $1 AND profile_id = $2 AND is_active = true",
        )
        .bind(service_id)
        .bind(&profile_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow!("That service was not found on this profile."))?;

        let within_hours: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM availability_rule r
                WHERE r.profile_id = $1 AND r.is_active = true
                  AND r.day = (ARRAY['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'])[extract(dow FROM ($2::timestamptz AT TIME ZONE $3))::int + 1]
                  AND r.start_minute <= (extract(hour FROM ($2::timestamptz AT TIME ZONE $3))::int * 60 + extract(minute FROM ($2::timestamptz AT TIME ZONE $3))::int)
                  AND r.end_minute >= (extract(hour FROM ($2::timestamptz AT TIME ZONE $3))::int * 60 + extract(minute FROM ($2::timestamptz AT TIME ZONE $3))::int) + $4::int
            )
            "#,
        )
        .bind(&profile_id)
        .bind(starts)
        .bind(&timezone)
        .bind(duration_minutes)
        .fetch_one(&self.db)
        .await?;
        if !within_hours {
            return Err(anyhow!("Invalid startsAt: that time is outside this profile's available hours"));
        }

        // Serializable, with an explicit overlap check: a unique index on the
        // start time cannot express "no overlap" between different durations.
        let mut attempt = 0;
        let appointment_id = loop {
            attempt += 1;
            match self
                .try_book(&profile_id, service_id, starts, duration_minutes, visitor_name, visitor_phone, visitor_email, notes)
                .await
            {
                Ok(id) => break id,
                Err(e) if is_serialization_failure(&e) && attempt < MAX_BOOKING_ATTEMPTS => continue,
                Err(e) if is_serialization_failure(&e) => return Err(anyhow!("That time is already taken.")),
                Err(e) => return Err(e),
            }
        };
        self.get_appointment(&profile_id, &appointment_id).await
    }

    async fn try_book(
        &self,
        profile_id: &str,
        service_id: &str,
        starts: DateTime<Utc>,
        duration_minutes: i32,
        visitor_name: &str,
        visitor_phone: Option<&str>,
        visitor_email: Option<&str>,
        notes: Option<&str>,
    ) -> Result<String> {
        let mut tx = self.db.begin().await?;
        sqlx::query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE").execute(&mut *tx).await?;

        let taken: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM appointment
                WHERE profile_id = $1 AND status IN ('PENDING', 'CONFIRMED')
                  AND starts_at < $2::timestamptz + make_interval(mins => $3::int) AND ends_at > $2::timestamptz
            )
            "#,
        )
        .bind(profile_id)
        .bind(starts)
        .bind(duration_minutes)
        .fetch_one(&mut *tx)
        .await?;
        if taken {
            return Err(anyhow!("That time is already taken."));
        }

        let id: String = sqlx::query_scalar(
            r#"
            INSERT INTO appointment (id, profile_id, service_id, status, starts_at, ends_at, visitor_name, visitor_phone, visitor_email, notes)
            VALUES (gen_random_uuid(), $1, $2, 'PENDING', $3::timestamptz, $3::timestamptz + make_interval(mins => $4::int), $5, $6, $7, $8)
            RETURNING id
            "#,
        )
        .bind(profile_id)
        .bind(service_id)
        .bind(starts)
        .bind(duration_minutes)
        .bind(visitor_name.trim())
        .bind(visitor_phone)
        .bind(visitor_email)
        .bind(notes)
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn day_names_are_normalised_and_checked() {
        assert_eq!(normalise_day(" monday ").unwrap(), "MONDAY");
        assert!(normalise_day("Funday").is_err());
    }

    #[test]
    fn windows_must_be_ordered_and_in_range() {
        assert!(check_window(540, 1020).is_ok());
        assert!(check_window(600, 600).is_err());
        assert!(check_window(700, 600).is_err());
        assert!(check_window(0, 1441).is_err());
        assert!(check_window(-1, 60).is_err());
    }

    #[test]
    fn dates_accept_a_timestamp_prefix() {
        assert_eq!(parse_date("from", "2026-11-16").unwrap().to_string(), "2026-11-16");
        assert_eq!(parse_date("from", "2026-11-16T00:00:00Z").unwrap().to_string(), "2026-11-16");
        assert!(parse_date("from", "16/11/2026").is_err());
    }
}
