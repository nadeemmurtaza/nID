//! Profiles service — full profile management with username gates, grants, and public projection.
//!
//! Mirrors `apps/api/src/modules/profiles/profiles.service.ts`.

use anyhow::{anyhow, Result};
use chrono::Utc;
use sqlx::{FromRow, Row};
use tracing::info;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::badges::cross_tenant::CrossTenantBadgesService;
use crate::modules::profiles::dto::{
    BadgeEntry, CreateProfileRequest, CreateGrantRequest, ProfileFieldGrantResponse,
    ProfileResponse, PublicProfileResponse, UpdateProfileRequest,
};

const RESERVED_PROFILE_SLUGS: [&str; 1] = ["me"];

#[derive(Debug, Clone, FromRow)]
pub struct ProfileRow {
    pub id: String,
    pub account_id: Option<String>,
    pub organization_id: Option<String>,
    pub slug: String,
    pub display_name: String,
    pub headline: Option<String>,
    pub category: String,
    pub bio: Option<String>,
    pub photo_key: Option<String>,
    pub phone: Option<String>,
    pub whatsapp: Option<String>,
    pub public_email: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub region: Option<String>,
    pub country_code: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub timezone: String,
    pub show_phone: bool,
    pub show_whatsapp: bool,
    pub show_email: bool,
    pub show_address: bool,
    pub show_badges: bool,
    pub show_booking: bool,
    pub show_offers: bool,
    pub show_hours: bool,
    pub show_real_name: bool,
    pub is_published: bool,
    pub username_set_at: Option<chrono::DateTime<chrono::Utc>>,
    pub username_source_name: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct AccountRow {
    pub id: String,
    pub phone: String,
}

pub struct ProfilesService {
    db: DbPool,
    env: AppEnv,
    badges: CrossTenantBadgesService,
}

impl ProfilesService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        let badges_db = DbPool::new(db.pool.clone());
        let badges = CrossTenantBadgesService::new(badges_db, env.clone());
        Self { db, env, badges }
    }

    fn row_to_response(row: ProfileRow) -> ProfileResponse {
        ProfileResponse {
            id: row.id,
            account_id: row.account_id,
            organization_id: row.organization_id,
            slug: row.slug,
            display_name: row.display_name,
            headline: row.headline,
            category: row.category,
            bio: row.bio,
            photo_key: row.photo_key,
            phone: row.phone,
            whatsapp: row.whatsapp,
            public_email: row.public_email,
            address_line1: row.address_line1,
            address_line2: row.address_line2,
            city: row.city,
            region: row.region,
            country_code: row.country_code,
            latitude: row.latitude,
            longitude: row.longitude,
            timezone: row.timezone,
            show_phone: row.show_phone,
            show_whatsapp: row.show_whatsapp,
            show_email: row.show_email,
            show_address: row.show_address,
            show_badges: row.show_badges,
            show_booking: row.show_booking,
            show_offers: row.show_offers,
            show_hours: row.show_hours,
            show_real_name: row.show_real_name,
            is_published: row.is_published,
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
        }
    }

    fn assert_not_reserved_slug(slug: &str) -> Result<()> {
        if RESERVED_PROFILE_SLUGS.contains(&slug) {
            return Err(anyhow!("\"{}\" is a reserved URL and cannot be used as a profile slug.", slug));
        }
        Ok(())
    }

    /// Slugify a real name for username comparison
    fn slugify_real_name(name: &str) -> String {
        name.to_lowercase()
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join("-")
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-')
            .collect()
    }

    /// Check if a slug matches the real name
    fn slug_matches_real_name(slug: &str, real_name_slug: &str) -> bool {
        slug == real_name_slug || slug.starts_with(&format!("{}-", real_name_slug))
    }

    /// Check if username is locked (7 days after set)
    fn is_username_locked(username_set_at: Option<&chrono::DateTime<chrono::Utc>>) -> bool {
        match username_set_at {
            Some(dt) => Utc::now().signed_duration_since(*dt).num_days() >= 7,
            None => false,
        }
    }

    /// Require verified real name for username gate
    async fn require_verified_real_name(&self, phone: &str) -> Result<String> {
        // Check for IDENTITY badge
        let has_identity = self.badges.has_identity_badge(phone).await?;
        if !has_identity {
            return Err(anyhow!("Verify your identity before choosing a username."));
        }

        // Look up verified name from phone_name_evidence
        let name = sqlx::query(
            "SELECT given_name, family_name FROM phone_name_evidence WHERE phone = $1 ORDER BY verified_at DESC LIMIT 1",
        )
        .bind(phone)
        .fetch_optional(&mut *self.db.get().await?)
        .await?;

        if name.is_none() {
            return Err(anyhow!(
                "A verified national ID with a phone number confirmed linked to it is required before choosing a username."
            ));
        }
        let name = name.unwrap();
        let given_name: String = name.get("given_name");
        let family_name: String = name.get("family_name");
        Ok(Self::slugify_real_name(&format!("{} {}", given_name, family_name)))
    }

    /// Create a new profile for an account
    pub async fn create(&self, account_id: &str, req: &CreateProfileRequest) -> Result<ProfileResponse> {
        Self::assert_not_reserved_slug(&req.slug)?;

        let mut conn = self.db.get().await?;

        // Get account phone for verification
        let account: AccountRow = sqlx::query_as(
            "SELECT id, phone FROM account WHERE id = $1",
        )
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Account not found"))?;

        // Verify real name
        let real_name_slug = self.require_verified_real_name(&account.phone).await?;
        if !Self::slug_matches_real_name(&req.slug, &real_name_slug) {
            return Err(anyhow!(
                "Username must be based on your verified name (\"{}\", or \"{}-...\" for a qualifier).",
                real_name_slug, real_name_slug
            ));
        }

        // Check for existing profile
        let existing = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1",
        )
        .bind(account_id)
        .fetch_optional(&mut *conn)
        .await?;

        if existing.is_some() {
            return Err(anyhow!("This account already has a profile."));
        }

        let category = req.category.as_deref().unwrap_or("GENERAL").to_string();
        let timezone = req.timezone.as_deref().unwrap_or("UTC").to_string();

        let profile: ProfileRow = sqlx::query_as(
            r#"
            INSERT INTO profile (id, account_id, slug, display_name, category, headline, bio, phone, whatsapp, public_email,
                address_line1, address_line2, city, region, country_code, latitude, longitude, timezone,
                show_phone, show_whatsapp, show_email, show_address, show_badges, show_booking, show_offers, show_hours, show_real_name, is_published,
                username_set_at, username_source_name)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW(), $28)
            RETURNING id, account_id, organization_id, slug, display_name, headline, category, bio, photo_key,
                phone, whatsapp, public_email, address_line1, address_line2, city, region, country_code, latitude, longitude,
                timezone, show_phone, show_whatsapp, show_email, show_address, show_badges, show_booking, show_offers, show_hours,
                show_real_name, is_published, username_set_at, username_source_name, created_at, updated_at
            "#,
        )
        .bind(account_id)
        .bind(&req.slug)
        .bind(&req.display_name)
        .bind(&category)
        .bind(&req.headline)
        .bind(&req.bio)
        .bind(&req.phone)
        .bind(&req.whatsapp)
        .bind(&req.public_email)
        .bind(&req.address_line1)
        .bind(&req.address_line2)
        .bind(&req.city)
        .bind(&req.region)
        .bind(&req.country_code)
        .bind(req.latitude)
        .bind(req.longitude)
        .bind(&timezone)
        .bind(req.show_phone.unwrap_or(false))
        .bind(req.show_whatsapp.unwrap_or(false))
        .bind(req.show_email.unwrap_or(false))
        .bind(req.show_address.unwrap_or(false))
        .bind(req.show_badges.unwrap_or(false))
        .bind(req.show_booking.unwrap_or(false))
        .bind(req.show_offers.unwrap_or(false))
        .bind(req.show_hours.unwrap_or(false))
        .bind(req.show_real_name.unwrap_or(false))
        .bind(req.is_published.unwrap_or(false))
        .bind(&real_name_slug)
        .fetch_one(&mut *conn)
        .await?;

        Ok(Self::row_to_response(profile))
    }

    /// Get profile by account ID (owner view)
    pub async fn get_mine(&self, account_id: &str) -> Result<ProfileResponse> {
        let conn = self.db.get().await?;

        let profile: ProfileRow = sqlx::query_as(
            "SELECT id, account_id, organization_id, slug, display_name, headline, category, bio, photo_key,
                phone, whatsapp, public_email, address_line1, address_line2, city, region, country_code, latitude, longitude,
                timezone, show_phone, show_whatsapp, show_email, show_address, show_badges, show_booking, show_offers, show_hours,
                show_real_name, is_published, username_set_at, username_source_name, created_at, updated_at
            FROM profile WHERE account_id = $1",
        )
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("No profile exists for this account"))?;

        Ok(Self::row_to_response(profile))
    }

    /// Update profile
    pub async fn update(&self, account_id: &str, req: &UpdateProfileRequest) -> Result<ProfileResponse> {
        let mut conn = self.db.get().await?;

        let profile: ProfileRow = sqlx::query_as(
            "SELECT id, account_id, organization_id, slug, display_name, headline, category, bio, photo_key,
                phone, whatsapp, public_email, address_line1, address_line2, city, region, country_code, latitude, longitude,
                timezone, show_phone, show_whatsapp, show_email, show_address, show_badges, show_booking, show_offers, show_hours,
                show_real_name, is_published, username_set_at, username_source_name, created_at, updated_at
            FROM profile WHERE account_id = $1",
        )
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("No profile exists for this account"))?;

        // If slug changed, verify real name
        let slug_changed = req.slug.as_ref().map_or(false, |s| s != &profile.slug);
        if slug_changed {
            let new_slug = req.slug.as_ref().unwrap();
            Self::assert_not_reserved_slug(new_slug)?;

            let account: AccountRow = sqlx::query_as(
                "SELECT id, phone FROM account WHERE id = $1",
            )
            .bind(account_id)
            .fetch_one(&mut *conn)
            .await
            .map_err(|_| anyhow!("Account not found"))?;

            let real_name_slug = self.require_verified_real_name(&account.phone).await?;
            if !Self::slug_matches_real_name(new_slug, &real_name_slug) {
                return Err(anyhow!(
                    "Username must be based on your verified name (\"{}\", or \"{}-...\" for a qualifier).",
                    real_name_slug, real_name_slug
                ));
            }

            // Check username lock
            let name_changed = profile.username_source_name.as_ref().map_or(true, |s| s != &real_name_slug);
            if !name_changed && Self::is_username_locked(profile.username_set_at.as_ref()) {
                return Err(anyhow!(
                    "This username is permanent. It can only be changed again if the verified name it was built from changes."
                ));
            }
        }

        let updated: ProfileRow = sqlx::query_as(
            r#"
            UPDATE profile SET
                slug = COALESCE($1, slug),
                display_name = COALESCE($2, display_name),
                headline = CASE WHEN $3::text IS NULL THEN headline ELSE $3 END,
                category = COALESCE($4, category),
                bio = CASE WHEN $5::text IS NULL THEN bio ELSE $5 END,
                phone = CASE WHEN $6::text IS NULL THEN phone ELSE $6 END,
                whatsapp = CASE WHEN $7::text IS NULL THEN whatsapp ELSE $7 END,
                public_email = CASE WHEN $8::text IS NULL THEN public_email ELSE $8 END,
                address_line1 = CASE WHEN $9::text IS NULL THEN address_line1 ELSE $9 END,
                address_line2 = CASE WHEN $10::text IS NULL THEN address_line2 ELSE $10 END,
                city = CASE WHEN $11::text IS NULL THEN city ELSE $11 END,
                region = CASE WHEN $12::text IS NULL THEN region ELSE $12 END,
                country_code = CASE WHEN $13::text IS NULL THEN country_code ELSE $13 END,
                latitude = COALESCE($14, latitude),
                longitude = COALESCE($15, longitude),
                timezone = COALESCE($16, timezone),
                show_phone = COALESCE($17, show_phone),
                show_whatsapp = COALESCE($18, show_whatsapp),
                show_email = COALESCE($19, show_email),
                show_address = COALESCE($20, show_address),
                show_badges = COALESCE($21, show_badges),
                show_booking = COALESCE($22, show_booking),
                show_offers = COALESCE($23, show_offers),
                show_hours = COALESCE($24, show_hours),
                show_real_name = COALESCE($25, show_real_name),
                is_published = COALESCE($26, is_published),
                username_set_at = CASE WHEN $27 IS NOT NULL AND $27 != slug THEN NOW() ELSE username_set_at END,
                username_source_name = CASE WHEN $27 IS NOT NULL AND $27 != slug THEN $28 ELSE username_source_name END
            WHERE account_id = $29
            RETURNING id, account_id, organization_id, slug, display_name, headline, category, bio, photo_key,
                phone, whatsapp, public_email, address_line1, address_line2, city, region, country_code, latitude, longitude,
                timezone, show_phone, show_whatsapp, show_email, show_address, show_badges, show_booking, show_offers, show_hours,
                show_real_name, is_published, username_set_at, username_source_name, created_at, updated_at
            "#,
        )
        .bind(&req.slug)
        .bind(&req.display_name)
        .bind(&req.headline)
        .bind(&req.category)
        .bind(req.bio.as_ref().map(|o| o.as_ref()).map(|o| o.unwrap_or("")))
        .bind(&req.phone)
        .bind(&req.whatsapp)
        .bind(&req.public_email)
        .bind(&req.address_line1)
        .bind(&req.address_line2)
        .bind(&req.city)
        .bind(&req.region)
        .bind(&req.country_code)
        .bind(req.latitude)
        .bind(req.longitude)
        .bind(&req.timezone)
        .bind(req.show_phone)
        .bind(req.show_whatsapp)
        .bind(req.show_email)
        .bind(req.show_address)
        .bind(req.show_badges)
        .bind(req.show_booking)
        .bind(req.show_offers)
        .bind(req.show_hours)
        .bind(req.show_real_name)
        .bind(req.is_published)
        .bind(&req.slug)
        .bind("")
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Profile not found"))?;

        Ok(Self::row_to_response(updated))
    }

    /// Get public profile by slug
    pub async fn get_public_by_slug(&self, slug: &str, viewer_account_id: Option<&str>) -> Result<PublicProfileResponse> {
        let mut conn = self.db.get().await?;

        let profile: ProfileRow = sqlx::query_as(
            "SELECT id, account_id, organization_id, slug, display_name, headline, category, bio, photo_key,
                phone, whatsapp, public_email, address_line1, address_line2, city, region, country_code, latitude, longitude,
                timezone, show_phone, show_whatsapp, show_email, show_address, show_badges, show_booking, show_offers, show_hours,
                show_real_name, is_published, username_set_at, username_source_name, created_at, updated_at
            FROM profile WHERE slug = $1",
        )
        .bind(slug)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("No published profile at this URL"))?;

        if !profile.is_published {
            return Err(anyhow!("No published profile at this URL"));
        }

        // Get account if personal profile
        let account: Option<AccountRow> = if profile.account_id.is_some() {
            sqlx::query_as(
                "SELECT id, phone FROM account WHERE id = $1",
            )
            .bind(&profile.account_id)
            .fetch_optional(&mut *conn)
            .await?
        } else {
            None
        };

        // Check for active grants to viewer
        let mut granted_fields: Vec<String> = Vec::new();
        if let Some(viewer_id) = viewer_account_id {
            let rows = sqlx::query(
                "SELECT field FROM profile_field_grant WHERE profile_id = $1 AND grantee_account_id = $2 AND revoked_at IS NULL",
            )
            .bind(&profile.id)
            .bind(viewer_id)
            .fetch_all(&mut *conn)
            .await?;
            granted_fields = rows.into_iter().map(|r| r.get("field")).collect();
        }

        // Determine visibility
        let show_phone = profile.show_phone || granted_fields.contains(&"PHONE".to_string());
        let show_whatsapp = profile.show_whatsapp || granted_fields.contains(&"WHATSAPP".to_string());
        let show_email = profile.show_email || granted_fields.contains(&"EMAIL".to_string());
        let show_address = profile.show_address || granted_fields.contains(&"ADDRESS".to_string());
        let show_real_name = profile.show_real_name || granted_fields.contains(&"REAL_NAME".to_string());

        // Get badges if shown
        let badges = if profile.show_badges {
            if let Some(ref acc) = account {
                let badge_list = self.badges.get_badges_for_phone(&acc.phone).await?;
                Some(
                    badge_list.into_iter().map(|b| BadgeEntry {
                        claim_type: b.claim_type,
                        level: b.level,
                        verified_at: b.verified_at,
                        case_id: b.case_id,
                    }).collect()
                )
            } else {
                None
            }
        } else {
            None
        };

        // Get real name if shown
        let real_name = if show_real_name {
            if account.is_some() {
                let acc = account.as_ref().unwrap();
                let name = sqlx::query(
                    "SELECT given_name, family_name FROM phone_name_evidence WHERE phone = $1 ORDER BY verified_at DESC LIMIT 1",
                )
                .bind(&acc.phone)
                .fetch_optional(&mut *conn)
                .await?;
                name.map(|n| {
                    let gn: String = n.get("given_name");
                    let fn_: String = n.get("family_name");
                    format!("{} {}", gn, fn_)
                })
            } else {
                Some(profile.organization_id.clone().unwrap_or_default())
            }
        } else {
            None
        };

        // Phone/whatsapp verification
        let phone_verified = show_phone && account.as_ref().map_or(false, |a| {
            profile.phone.as_ref().map_or(false, |p| p == &a.phone)
        });
        let whatsapp_verified = show_whatsapp && account.as_ref().map_or(false, |a| {
            profile.whatsapp.as_ref().map_or(false, |w| w == &a.phone)
        });

        Ok(PublicProfileResponse {
            id: profile.id,
            slug: profile.slug,
            display_name: profile.display_name,
            headline: profile.headline,
            category: profile.category,
            bio: profile.bio,
            photo_key: profile.photo_key,
            timezone: profile.timezone,
            phone: show_phone.then(|| profile.phone.clone()).flatten(),
            whatsapp: show_whatsapp.then(|| profile.whatsapp.clone()).flatten(),
            public_email: show_email.then(|| profile.public_email.clone()).flatten(),
            address_line1: show_address.then(|| profile.address_line1.clone()).flatten(),
            address_line2: show_address.then(|| profile.address_line2.clone()).flatten(),
            city: show_address.then(|| profile.city.clone()).flatten(),
            region: show_address.then(|| profile.region.clone()).flatten(),
            country_code: show_address.then(|| profile.country_code.clone()).flatten(),
            latitude: show_address.then(|| profile.latitude).flatten(),
            longitude: show_address.then(|| profile.longitude).flatten(),
            show_booking: profile.show_booking,
            show_offers: profile.show_offers,
            show_hours: profile.show_hours,
            badges,
            real_name,
            phone_verified,
            whatsapp_verified,
        })
    }

    /// Create a field grant
    pub async fn create_grant(&self, account_id: &str, req: &CreateGrantRequest) -> Result<ProfileFieldGrantResponse> {
        let mut conn = self.db.get().await?;

        let profile: ProfileRow = sqlx::query_as(
            "SELECT id FROM profile WHERE account_id = $1",
        )
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("No profile exists for this account"))?;

        // Look up grantee by slug
        let grantee: ProfileRow = sqlx::query_as(
            "SELECT id, account_id, organization_id FROM profile WHERE slug = $1",
        )
        .bind(&req.grantee_slug)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("No profile found for username \"{}\"", req.grantee_slug))?;

        if grantee.id == profile.id {
            return Err(anyhow!("Cannot grant access to your own profile."));
        }

        // Check for existing grant
        let existing = sqlx::query(
            "SELECT id, revoked_at FROM profile_field_grant WHERE profile_id = $1 AND field = $2 AND (grantee_account_id = $3 OR grantee_organization_id = $4)",
        )
        .bind(&profile.id)
        .bind(&req.field)
        .bind(&grantee.account_id)
        .bind(&grantee.organization_id)
        .fetch_optional(&mut *conn)
        .await?;

        if let Some(row) = existing {
            let revoked_at: Option<chrono::DateTime<chrono::Utc>> = row.get("revoked_at");
            if revoked_at.is_none() {
                // Already active, return it
                let grant = sqlx::query(
                    "SELECT id, profile_id, field, grantee_account_id, grantee_organization_id, created_at, revoked_at FROM profile_field_grant WHERE id = $1",
                )
                .bind(row.get::<String, _>("id"))
                .fetch_one(&mut *conn)
                .await?;
                return Ok(Self::grant_to_response(grant));
            } else {
                // Reactivate
                sqlx::query(
                    "UPDATE profile_field_grant SET revoked_at = NULL WHERE id = $1",
                )
                .bind(row.get::<String, _>("id"))
                .execute(&mut *conn)
                .await?;
            }
        }

        // Create new grant
        let grant = sqlx::query(
            r#"
            INSERT INTO profile_field_grant (id, profile_id, field, grantee_account_id, grantee_organization_id)
            VALUES (gen_random_uuid(), $1, $2, $3, $4)
            RETURNING id, profile_id, field, grantee_account_id, grantee_organization_id, created_at, revoked_at
            "#,
        )
        .bind(&profile.id)
        .bind(&req.field)
        .bind(&grantee.account_id)
        .bind(&grantee.organization_id)
        .fetch_one(&mut *conn)
        .await?;

        Ok(Self::grant_to_response(grant))
    }

    /// List active grants
    pub async fn list_grants(&self, account_id: &str) -> Result<Vec<ProfileFieldGrantResponse>> {
        let mut conn = self.db.get().await?;

        let profile = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1",
        )
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("No profile exists for this account"))?;
        let profile_id: String = profile.get("id");

        let rows = sqlx::query(
            "SELECT id, profile_id, field, grantee_account_id, grantee_organization_id, created_at, revoked_at FROM profile_field_grant WHERE profile_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(Self::grant_to_response).collect())
    }

    /// Revoke a grant
    pub async fn revoke_grant(&self, account_id: &str, grant_id: &str) -> Result<()> {
        let mut conn = self.db.get().await?;

        let profile = sqlx::query(
            "SELECT id FROM profile WHERE account_id = $1",
        )
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("No profile exists for this account"))?;
        let profile_id: String = profile.get("id");

        let grant = sqlx::query(
            "SELECT id, profile_id, revoked_at FROM profile_field_grant WHERE id = $1",
        )
        .bind(grant_id)
        .fetch_optional(&mut *conn)
        .await?;

        if grant.is_none() {
            return Err(anyhow!("No such grant"));
        }
        let grant = grant.unwrap();
        let g_profile_id: String = grant.get("profile_id");
        if g_profile_id != profile_id {
            return Err(anyhow!("No such grant"));
        }

        let revoked_at: Option<chrono::DateTime<chrono::Utc>> = grant.get("revoked_at");
        if revoked_at.is_none() {
            sqlx::query(
                "UPDATE profile_field_grant SET revoked_at = NOW() WHERE id = $1",
            )
            .bind(grant_id)
            .execute(&mut *conn)
            .await?;
        }

        Ok(())
    }

    fn grant_to_response(row: sqlx::postgres::PgRow) -> ProfileFieldGrantResponse {
        ProfileFieldGrantResponse {
            id: row.get("id"),
            profile_id: row.get("profile_id"),
            field: row.get("field"),
            grantee_account_id: row.get("grantee_account_id"),
            grantee_organization_id: row.get("grantee_organization_id"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            revoked_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("revoked_at")
                .map(|d| d.to_rfc3339()),
        }
    }

    /// Get badges for an account
    pub async fn get_badges(&self, account_id: &str) -> Result<Vec<BadgeEntry>> {
        let mut conn = self.db.get().await?;

        let account: AccountRow = sqlx::query_as(
            "SELECT id, phone FROM account WHERE id = $1",
        )
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Account not found"))?;

        let badges = self.badges.get_badges_for_phone(&account.phone).await?;
        Ok(badges.into_iter().map(|b| BadgeEntry {
            claim_type: b.claim_type,
            level: b.level,
            verified_at: b.verified_at,
            case_id: b.case_id,
        }).collect())
    }
}
