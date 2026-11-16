//! Profile content service — business logic for profile content operations.
//!
//! Extracted from `apps/rust-api/src/modules/profile_content/service.rs` as part of
//! CONVENTIONS.md's crates/services split. Takes a plain `sqlx::PgPool`
//! rather than nID's `core::db::DbPool` wrapper.

use anyhow::{anyhow, Result};
use sqlx::{FromRow, PgPool};

/// Only http(s) links may be stored: these URLs are rendered as hrefs on
/// public profiles, so `javascript:` and `data:` URLs would be stored XSS.
fn validate_url(field: &str, url: &str) -> Result<()> {
    let u = url.trim();
    if u.len() > 2048 || !(u.starts_with("https://") || u.starts_with("http://")) {
        return Err(anyhow!("{field} must be an http(s) URL of at most 2048 characters"));
    }
    Ok(())
}

fn validate_len(field: &str, v: &str, min: usize, max: usize) -> Result<()> {
    let n = v.trim().chars().count();
    if n < min || n > max {
        return Err(anyhow!("{field} must be between {min} and {max} characters"));
    }
    Ok(())
}

// ── Row types ──

#[derive(Debug, Clone, FromRow)]
struct ProfileRow {
    id: String,
}

// ── Public response types ──

#[derive(Debug, Clone)]
pub struct OfferResponse {
    pub id: String,
    pub profile_id: String,
    pub title: String,
    pub description: Option<String>,
    pub valid_until: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone)]
pub struct BusinessHourResponse {
    pub id: String,
    pub profile_id: String,
    pub day: String,
    pub open_minute: Option<i32>,
    pub close_minute: Option<i32>,
    pub is_closed: bool,
}

#[derive(Debug, Clone)]
pub struct CustomLinkResponse {
    pub id: String,
    pub profile_id: String,
    pub label: String,
    pub url: String,
    pub order: i32,
}

#[derive(Debug, Clone)]
pub struct SocialLinkResponse {
    pub id: String,
    pub profile_id: String,
    pub platform: String,
    pub url: String,
    pub order: i32,
}

#[derive(Debug, Clone)]
pub struct ProfileImageResponse {
    pub id: String,
    pub profile_id: String,
    pub kind: String,
    pub url: String,
    pub content_type: String,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct ContactMessageResponse {
    pub id: String,
    pub profile_id: String,
    pub sender_name: String,
    pub sender_phone: Option<String>,
    pub sender_email: Option<String>,
    pub message: String,
    pub read_at: Option<String>,
    pub created_at: String,
}

// ── Request types ──

#[derive(Debug)]
pub struct CreateOfferRequest {
    pub title: String,
    pub description: Option<String>,
    pub valid_until: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Default)]
pub struct UpdateOfferRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub valid_until: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug)]
pub struct UpsertBusinessHourRequest {
    pub open_minute: Option<i32>,
    pub close_minute: Option<i32>,
    pub is_closed: bool,
}

#[derive(Debug)]
pub struct CreateCustomLinkRequest {
    pub label: String,
    pub url: String,
    pub order: Option<i32>,
}

#[derive(Debug, Default)]
pub struct UpdateCustomLinkRequest {
    pub label: Option<String>,
    pub url: Option<String>,
    pub order: Option<i32>,
}

#[derive(Debug)]
pub struct CreateSocialLinkRequest {
    pub platform: String,
    pub url: String,
    pub order: Option<i32>,
}

#[derive(Debug, Default)]
pub struct UpdateSocialLinkRequest {
    pub platform: Option<String>,
    pub url: Option<String>,
    pub order: Option<i32>,
}

#[derive(Debug)]
pub struct UploadedFile {
    pub content_type: String,
    pub data: Vec<u8>,
}

#[derive(Debug)]
pub struct CreateContactMessageRequest {
    pub sender_name: String,
    pub sender_phone: Option<String>,
    pub sender_email: Option<String>,
    pub message: String,
}

// ── Service ──

#[derive(sqlx::FromRow)]
struct OfferRow {
    id: String,
    profile_id: String,
    title: String,
    description: Option<String>,
    valid_until: Option<chrono::DateTime<chrono::Utc>>,
    is_active: bool,
}
impl From<OfferRow> for OfferResponse {
    fn from(r: OfferRow) -> Self {
        Self { id: r.id, profile_id: r.profile_id, title: r.title, description: r.description, valid_until: r.valid_until.map(|d| d.to_rfc3339()), is_active: r.is_active }
    }
}

#[derive(sqlx::FromRow)]
struct HourRow {
    id: String,
    profile_id: String,
    day: String,
    open_minute: Option<i32>,
    close_minute: Option<i32>,
    is_closed: bool,
}
impl From<HourRow> for BusinessHourResponse {
    fn from(r: HourRow) -> Self {
        Self { id: r.id, profile_id: r.profile_id, day: r.day, open_minute: r.open_minute, close_minute: r.close_minute, is_closed: r.is_closed }
    }
}

/// custom_link and social_link share this shape: (label | platform), url, order.
#[derive(sqlx::FromRow)]
struct LinkRow {
    id: String,
    profile_id: String,
    #[sqlx(rename = "label")]
    name: String,
    url: String,
    order: i32,
}
impl From<LinkRow> for CustomLinkResponse {
    fn from(r: LinkRow) -> Self {
        Self { id: r.id, profile_id: r.profile_id, label: r.name, url: r.url, order: r.order }
    }
}

impl From<LinkRow> for SocialLinkResponse {
    fn from(r: LinkRow) -> Self {
        Self { id: r.id, profile_id: r.profile_id, platform: r.name, url: r.url, order: r.order }
    }
}

#[derive(sqlx::FromRow)]
struct MessageRow {
    id: String,
    profile_id: String,
    sender_name: String,
    sender_phone: Option<String>,
    sender_email: Option<String>,
    message: String,
    read_at: Option<chrono::DateTime<chrono::Utc>>,
    created_at: chrono::DateTime<chrono::Utc>,
}
impl From<MessageRow> for ContactMessageResponse {
    fn from(r: MessageRow) -> Self {
        Self { id: r.id, profile_id: r.profile_id, sender_name: r.sender_name, sender_phone: r.sender_phone, sender_email: r.sender_email, message: r.message, read_at: r.read_at.map(|d| d.to_rfc3339()), created_at: r.created_at.to_rfc3339() }
    }
}

fn bad_timestamp(e: sqlx::Error) -> anyhow::Error {
    if e.to_string().contains("timestamp") {
        anyhow!("Invalid: validUntil must be an ISO 8601 date-time")
    } else {
        e.into()
    }
}

fn bad_enum(e: sqlx::Error) -> anyhow::Error {
    if e.to_string().contains("invalid input value for enum") {
        anyhow!("Invalid: that value is not one of the allowed options")
    } else {
        e.into()
    }
}

pub struct ProfileContentService {
    db: PgPool,
    storage: Option<std::sync::Arc<nid_storage::LocalStorageDriver>>,
}

impl ProfileContentService {
    pub fn with_storage(mut self, storage: std::sync::Arc<nid_storage::LocalStorageDriver>) -> Self {
        self.storage = Some(storage);
        self
    }

    /// Persist an upload and return (storage key, detected content type).
    /// Images only, decided by the file's leading bytes, never the
    /// client-supplied MIME type.
    async fn store_image(&self, profile_id: &str, kind: &str, file: &UploadedFile) -> Result<(String, String)> {
        use nid_storage::StorageDriver;
        let storage = self
            .storage
            .as_ref()
            .ok_or_else(|| anyhow!("File storage is not configured"))?;
        let content_type = match nid_storage::sniff_content_type(&file.data) {
            Some(t) if t.starts_with("image/") => t,
            _ => return Err(anyhow!("Unsupported file type: upload a JPEG, PNG or WebP image")),
        };
        if file.data.len() > 5 * 1024 * 1024 {
            return Err(anyhow!("Image must be at most 5 MB"));
        }
        let stored = storage
            .put(nid_storage::PutDocumentInput {
                namespace: format!("profile-{kind}"),
                group_id: profile_id.to_string(),
                filename: "upload".to_string(),
                content_type: content_type.to_string(),
                body: file.data.clone(),
            })
            .await
            .map_err(|e| anyhow!("Failed to store file: {e}"))?;
        Ok((stored.key, content_type.to_string()))
    }

    pub fn new(db: PgPool) -> Self {
        Self { db, storage: None }
    }

    async fn get_profile_id(&self, account_id: &str) -> Result<String> {
        let profile_id = sqlx::query_scalar("SELECT id FROM profile WHERE account_id = $1 LIMIT 1")
            .bind(account_id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| anyhow!("No profile found for this account"))?;
        Ok(profile_id)
    }

    async fn get_published_profile_id(&self, slug: &str) -> Result<String> {
        let profile_id = sqlx::query_scalar("SELECT id FROM profile WHERE slug = $1 AND is_published = true LIMIT 1")
            .bind(slug)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| anyhow!("No published profile at this URL"))?;
        Ok(profile_id)
    }

    // ── Offers ──

    pub async fn create_offer(
        &self,
        account_id: &str,
        req: &CreateOfferRequest,
    ) -> Result<OfferResponse> {
        validate_len("title", &req.title, 1, 120)?;
        if let Some(d) = &req.description {
            validate_len("description", d, 0, 2000)?;
        }
        let profile_id = self.get_profile_id(account_id).await?;

        let row: OfferRow = sqlx::query_as(
            r#"
            INSERT INTO offer (id, profile_id, title, description, valid_until, is_active)
            VALUES (gen_random_uuid(), $1, $2, $3, $4::timestamptz, $5)
            RETURNING id, profile_id, title, description, valid_until, is_active
            "#,
        )
        .bind(&profile_id)
        .bind(&req.title)
        .bind(&req.description)
        .bind(&req.valid_until)
        .bind(req.is_active.unwrap_or(true))
        .fetch_one(&self.db)
        .await
        .map_err(bad_timestamp)?;
        Ok(row.into())
    }

    pub async fn list_my_offers(&self, account_id: &str) -> Result<Vec<OfferResponse>> {
        let profile_id = self.get_profile_id(account_id).await?;
        let rows: Vec<OfferRow> = sqlx::query_as(
            "SELECT id, profile_id, title, description, valid_until, is_active FROM offer WHERE profile_id = $1 ORDER BY created_at DESC",
        )
        .bind(&profile_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn update_offer(
        &self,
        account_id: &str,
        offer_id: &str,
        req: &UpdateOfferRequest,
    ) -> Result<OfferResponse> {
        if let Some(t) = &req.title {
            validate_len("title", t, 1, 120)?;
        }
        if let Some(d) = &req.description {
            validate_len("description", d, 0, 2000)?;
        }
        let profile_id = self.get_profile_id(account_id).await?;
        let row: OfferRow = sqlx::query_as(
            r#"
            UPDATE offer SET
                title = COALESCE($3, title),
                description = COALESCE($4, description),
                valid_until = COALESCE($5::timestamptz, valid_until),
                is_active = COALESCE($6, is_active)
            WHERE id = $1 AND profile_id = $2
            RETURNING id, profile_id, title, description, valid_until, is_active
            "#,
        )
        .bind(offer_id)
        .bind(&profile_id)
        .bind(&req.title)
        .bind(&req.description)
        .bind(&req.valid_until)
        .bind(req.is_active)
        .fetch_optional(&self.db)
        .await
        .map_err(bad_timestamp)?
        .ok_or_else(|| anyhow!("Offer not found"))?;
        Ok(row.into())
    }

    pub async fn remove_offer(&self, account_id: &str, offer_id: &str) -> Result<()> {
        let profile_id = self.get_profile_id(account_id).await?;
        let result = sqlx::query("DELETE FROM offer WHERE id = $1 AND profile_id = $2")
            .bind(offer_id)
            .bind(&profile_id)
            .execute(&self.db)
            .await?;
        if result.rows_affected() == 0 {
            return Err(anyhow!("Offer not found."));
        }
        Ok(())
    }

    // ── Business Hours ──

    pub async fn upsert_business_hour(
        &self,
        account_id: &str,
        day: &str,
        req: &UpsertBusinessHourRequest,
    ) -> Result<BusinessHourResponse> {
        if !req.is_closed {
            match (req.open_minute, req.close_minute) {
                (Some(o), Some(c)) if (0..=1439).contains(&o) && (1..=1440).contains(&c) && o < c => {}
                _ => return Err(anyhow!("Invalid: openMinute (0-1439) must be before closeMinute (1-1440)")),
            }
        }
        let (open, close) = if req.is_closed { (None, None) } else { (req.open_minute, req.close_minute) };
        let profile_id = self.get_profile_id(account_id).await?;

        // The table is reached through a view, which cannot take ON CONFLICT,
        // so update first and insert only if the day has no row yet.
        let updated: Option<HourRow> = sqlx::query_as(
            r#"
            UPDATE business_hour SET open_minute = $3, close_minute = $4, is_closed = $5
            WHERE profile_id = $1 AND day = $2
            RETURNING id, profile_id, day, open_minute, close_minute, is_closed
            "#,
        )
        .bind(&profile_id)
        .bind(day)
        .bind(open)
        .bind(close)
        .bind(req.is_closed)
        .fetch_optional(&self.db)
        .await
        .map_err(bad_enum)?;
        if let Some(h) = updated {
            return Ok(h.into());
        }
        let row: HourRow = sqlx::query_as(
            r#"
            INSERT INTO business_hour (id, profile_id, day, open_minute, close_minute, is_closed)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
            RETURNING id, profile_id, day, open_minute, close_minute, is_closed
            "#,
        )
        .bind(&profile_id)
        .bind(day)
        .bind(open)
        .bind(close)
        .bind(req.is_closed)
        .fetch_one(&self.db)
        .await
        .map_err(bad_enum)?;
        Ok(row.into())
    }

    pub async fn list_my_business_hours(&self, account_id: &str) -> Result<Vec<BusinessHourResponse>> {
        let profile_id = self.get_profile_id(account_id).await?;
        self.hours_for(&profile_id).await
    }

    async fn hours_for(&self, profile_id: &str) -> Result<Vec<BusinessHourResponse>> {
        let rows: Vec<HourRow> = sqlx::query_as(
            r#"
            SELECT id, profile_id, day, open_minute, close_minute, is_closed FROM business_hour
            WHERE profile_id = $1
            ORDER BY CASE day WHEN 'MONDAY' THEN 1 WHEN 'TUESDAY' THEN 2 WHEN 'WEDNESDAY' THEN 3
                              WHEN 'THURSDAY' THEN 4 WHEN 'FRIDAY' THEN 5 WHEN 'SATURDAY' THEN 6 ELSE 7 END
            "#,
        )
        .bind(profile_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn remove_business_hour(&self, account_id: &str, day: &str) -> Result<()> {
        let profile_id = self.get_profile_id(account_id).await?;
        let result = sqlx::query("DELETE FROM business_hour WHERE profile_id = $1 AND day = $2")
            .bind(&profile_id)
            .bind(day)
            .execute(&self.db)
            .await?;
        if result.rows_affected() == 0 {
            return Err(anyhow!("Business hour not found."));
        }
        Ok(())
    }

    // ── Custom Links ──

    pub async fn create_custom_link(
        &self,
        account_id: &str,
        req: &CreateCustomLinkRequest,
    ) -> Result<CustomLinkResponse> {
        validate_url("url", &req.url)?;
        validate_len("label", &req.label, 1, 100)?;
        let profile_id = self.get_profile_id(account_id).await?;
        let row: LinkRow = sqlx::query_as(
            r#"
            INSERT INTO custom_link (id, profile_id, label, url, "order")
            VALUES (gen_random_uuid(), $1, $2, $3, $4)
            RETURNING id, profile_id, label, url, "order"
            "#,
        )
        .bind(&profile_id)
        .bind(&req.label)
        .bind(&req.url)
        .bind(req.order.unwrap_or(0))
        .fetch_one(&self.db)
        .await?;
        Ok(row.into())
    }

    pub async fn list_my_custom_links(&self, account_id: &str) -> Result<Vec<CustomLinkResponse>> {
        let profile_id = self.get_profile_id(account_id).await?;
        self.custom_links_for(&profile_id).await
    }

    async fn custom_links_for(&self, profile_id: &str) -> Result<Vec<CustomLinkResponse>> {
        let rows: Vec<LinkRow> = sqlx::query_as(
            r#"SELECT id, profile_id, label, url, "order" FROM custom_link WHERE profile_id = $1 ORDER BY "order", created_at"#,
        )
        .bind(profile_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn remove_custom_link(&self, account_id: &str, link_id: &str) -> Result<()> {
        let profile_id = self.get_profile_id(account_id).await?;
        let result = sqlx::query("DELETE FROM custom_link WHERE id = $1 AND profile_id = $2")
            .bind(link_id)
            .bind(&profile_id)
            .execute(&self.db)
            .await?;
        if result.rows_affected() == 0 {
            return Err(anyhow!("Link not found."));
        }
        Ok(())
    }

    pub async fn update_custom_link(
        &self,
        account_id: &str,
        link_id: &str,
        req: &UpdateCustomLinkRequest,
    ) -> Result<CustomLinkResponse> {
        if let Some(u) = &req.url {
            validate_url("url", u)?;
        }
        if let Some(l) = &req.label {
            validate_len("label", l, 1, 100)?;
        }
        let profile_id = self.get_profile_id(account_id).await?;
        let row: LinkRow = sqlx::query_as(
            r#"
            UPDATE custom_link SET
                label = COALESCE($3, label),
                url = COALESCE($4, url),
                "order" = COALESCE($5, "order")
            WHERE id = $1 AND profile_id = $2
            RETURNING id, profile_id, label, url, "order"
            "#,
        )
        .bind(link_id)
        .bind(&profile_id)
        .bind(&req.label)
        .bind(&req.url)
        .bind(req.order)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow!("Link not found"))?;
        Ok(row.into())
    }

    // ── Social Links ──

    pub async fn create_social_link(
        &self,
        account_id: &str,
        req: &CreateSocialLinkRequest,
    ) -> Result<SocialLinkResponse> {
        validate_url("url", &req.url)?;
        let profile_id = self.get_profile_id(account_id).await?;
        let row: LinkRow = sqlx::query_as(
            r#"
            INSERT INTO social_link (id, profile_id, platform, url, "order")
            VALUES (gen_random_uuid(), $1, $2, $3, $4)
            RETURNING id, profile_id, platform AS label, url, "order"
            "#,
        )
        .bind(&profile_id)
        .bind(&req.platform)
        .bind(&req.url)
        .bind(req.order.unwrap_or(0))
        .fetch_one(&self.db)
        .await
        .map_err(bad_enum)?;
        Ok(row.into())
    }

    pub async fn list_my_social_links(&self, account_id: &str) -> Result<Vec<SocialLinkResponse>> {
        let profile_id = self.get_profile_id(account_id).await?;
        self.social_links_for(&profile_id).await
    }

    async fn social_links_for(&self, profile_id: &str) -> Result<Vec<SocialLinkResponse>> {
        let rows: Vec<LinkRow> = sqlx::query_as(
            r#"SELECT id, profile_id, platform AS label, url, "order" FROM social_link WHERE profile_id = $1 ORDER BY "order", platform"#,
        )
        .bind(profile_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn remove_social_link(&self, account_id: &str, link_id: &str) -> Result<()> {
        let profile_id = self.get_profile_id(account_id).await?;
        let result = sqlx::query("DELETE FROM social_link WHERE id = $1 AND profile_id = $2")
            .bind(link_id)
            .bind(&profile_id)
            .execute(&self.db)
            .await?;
        if result.rows_affected() == 0 {
            return Err(anyhow!("Link not found."));
        }
        Ok(())
    }

    pub async fn update_social_link(
        &self,
        account_id: &str,
        link_id: &str,
        req: &UpdateSocialLinkRequest,
    ) -> Result<SocialLinkResponse> {
        if let Some(u) = &req.url {
            validate_url("url", u)?;
        }
        let profile_id = self.get_profile_id(account_id).await?;
        let row: LinkRow = sqlx::query_as(
            r#"
            UPDATE social_link SET
                platform = COALESCE($3, platform),
                url = COALESCE($4, url),
                "order" = COALESCE($5, "order")
            WHERE id = $1 AND profile_id = $2
            RETURNING id, profile_id, platform AS label, url, "order"
            "#,
        )
        .bind(link_id)
        .bind(&profile_id)
        .bind(&req.platform)
        .bind(&req.url)
        .bind(req.order)
        .fetch_optional(&self.db)
        .await
        .map_err(bad_enum)?
        .ok_or_else(|| anyhow!("Link not found"))?;
        Ok(row.into())
    }

    // ── Profile Images ──

    pub async fn upload_photo(
        &self,
        account_id: &str,
        file: UploadedFile,
    ) -> Result<ProfileImageResponse> {
        let profile_id = self.get_profile_id(account_id).await?;

        let (file_id, content_type) = self.store_image(&profile_id, "photo", &file).await?;

        // The profile photo lives on the profile row (photoKey/photoContentType);
        // ProfileImage is only for BANNER and GALLERY images.
        sqlx::query("UPDATE profile SET photo_key = $2, photo_content_type = $3, updated_at = NOW() WHERE id = $1")
            .bind(&profile_id)
            .bind(&file_id)
            .bind(&content_type)
            .execute(&self.db)
            .await?;

        tracing::info!(profile_id = %profile_id, file_id = %file_id, "Profile photo uploaded");

        Ok(ProfileImageResponse {
            id: file_id.clone(),
            profile_id,
            kind: "photo".to_string(),
            url: file_id,
            content_type,
            created_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    pub async fn upload_gallery_image(
        &self,
        account_id: &str,
        kind: &str,
        file: UploadedFile,
    ) -> Result<ProfileImageResponse> {
        let profile_id = self.get_profile_id(account_id).await?;

        let kind = kind.to_uppercase();
        if kind != "BANNER" && kind != "GALLERY" {
            return Err(anyhow!("kind must be banner or gallery"));
        }
        let (file_id, content_type) = self.store_image(&profile_id, "gallery", &file).await?;

        let img: (String, String, String, String, String, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
            r#"
            INSERT INTO profile_image (id, profile_id, kind, storage_key, content_type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, profile_id, kind, storage_key, content_type, created_at
            "#,
        )
        .bind(&file_id)
        .bind(&profile_id)
        .bind(&kind)
        .bind(&file_id)
        .bind(&content_type)
        .fetch_one(&self.db)
        .await?;

        tracing::info!(profile_id = %profile_id, file_id = %file_id, kind = %kind, "Gallery image uploaded");

        Ok(ProfileImageResponse {
            id: img.0, profile_id: img.1, kind: img.2, url: img.3, content_type: img.4, created_at: img.5.to_rfc3339(),
        })
    }

    pub async fn list_my_images(&self, account_id: &str) -> Result<Vec<ProfileImageResponse>> {
        let profile_id = self.get_profile_id(account_id).await?;

        let rows: Vec<(String, String, String, String, String, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
            "SELECT id, profile_id, kind, storage_key, content_type, created_at FROM profile_image WHERE profile_id = $1 ORDER BY created_at DESC",
        )
        .bind(&profile_id)
        .fetch_all(&self.db)
        .await?;

        Ok(rows.into_iter().map(|r| ProfileImageResponse {
            id: r.0, profile_id: r.1, kind: r.2, url: r.3, content_type: r.4, created_at: r.5.to_rfc3339(),
        }).collect())
    }

    pub async fn remove_image(&self, account_id: &str, image_id: &str) -> Result<()> {
        let profile_id = self.get_profile_id(account_id).await?;

        let result = sqlx::query("DELETE FROM profile_image WHERE id = $1 AND profile_id = $2")
            .bind(image_id)
            .bind(&profile_id)
            .execute(&self.db)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Image not found."));
        }
        Ok(())
    }

    pub async fn list_public_images(&self, slug: &str) -> Result<Vec<ProfileImageResponse>> {
        let profile_id = self.get_published_profile_id(slug).await?;

        let rows: Vec<(String, String, String, String, String, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
            "SELECT id, profile_id, kind, storage_key, content_type, created_at FROM profile_image WHERE profile_id = $1 ORDER BY created_at DESC",
        )
        .bind(&profile_id)
        .fetch_all(&self.db)
        .await?;

        Ok(rows.into_iter().map(|r| ProfileImageResponse {
            id: r.0, profile_id: r.1, kind: r.2, url: r.3, content_type: r.4, created_at: r.5.to_rfc3339(),
        }).collect())
    }

    // ── Contact Messages ──

    pub async fn list_my_contact_messages(&self, account_id: &str) -> Result<Vec<ContactMessageResponse>> {
        let profile_id = self.get_profile_id(account_id).await?;
        let rows: Vec<MessageRow> = sqlx::query_as(
            "SELECT id, profile_id, sender_name, sender_phone, sender_email, message, read_at, created_at FROM contact_message WHERE profile_id = $1 ORDER BY created_at DESC",
        )
        .bind(&profile_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn mark_contact_message_read(&self, account_id: &str, message_id: &str) -> Result<ContactMessageResponse> {
        let profile_id = self.get_profile_id(account_id).await?;
        let row: MessageRow = sqlx::query_as(
            "UPDATE contact_message SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND profile_id = $2 RETURNING id, profile_id, sender_name, sender_phone, sender_email, message, read_at, created_at",
        )
        .bind(message_id)
        .bind(&profile_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow!("Message not found"))?;
        Ok(row.into())
    }

    pub async fn create_public_contact_message(
        &self,
        slug: &str,
        req: &CreateContactMessageRequest,
    ) -> Result<ContactMessageResponse> {
        validate_len("senderName", &req.sender_name, 1, 120)?;
        validate_len("message", &req.message, 1, 4000)?;
        if let Some(p) = &req.sender_phone {
            validate_len("senderPhone", p, 0, 32)?;
        }
        if let Some(e) = &req.sender_email {
            if !e.contains('@') || e.len() > 254 {
                return Err(anyhow!("senderEmail must be a valid address"));
            }
        }
        let profile_id = self.get_published_profile_id(slug).await?;
        let row: MessageRow = sqlx::query_as(
            r#"
            INSERT INTO contact_message (id, profile_id, sender_name, sender_phone, sender_email, message)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
            RETURNING id, profile_id, sender_name, sender_phone, sender_email, message, read_at, created_at
            "#,
        )
        .bind(&profile_id)
        .bind(&req.sender_name)
        .bind(&req.sender_phone)
        .bind(&req.sender_email)
        .bind(&req.message)
        .fetch_one(&self.db)
        .await?;
        Ok(row.into())
    }

    // ── Public endpoints ──

    pub async fn list_public_offers(&self, slug: &str) -> Result<Vec<OfferResponse>> {
        let profile_id = self.get_published_profile_id(slug).await?;
        let rows: Vec<OfferRow> = sqlx::query_as(
            "SELECT id, profile_id, title, description, valid_until, is_active FROM offer WHERE profile_id = $1 AND is_active = true AND (valid_until IS NULL OR valid_until > NOW()) ORDER BY created_at DESC",
        )
        .bind(&profile_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn list_public_business_hours(&self, slug: &str) -> Result<Vec<BusinessHourResponse>> {
        let profile_id = self.get_published_profile_id(slug).await?;
        self.hours_for(&profile_id).await
    }

    pub async fn list_public_links(&self, slug: &str) -> Result<(Vec<CustomLinkResponse>, Vec<SocialLinkResponse>)> {
        let profile_id = self.get_published_profile_id(slug).await?;
        Ok((self.custom_links_for(&profile_id).await?, self.social_links_for(&profile_id).await?))
    }

    pub async fn get_public_photo(&self, slug: &str) -> Result<(String, String)> {
        let profile_id = self.get_published_profile_id(slug).await?;

        let (url, content_type): (String, String) = sqlx::query_as(
            "SELECT photo_key, photo_content_type FROM profile
             WHERE id = $1 AND photo_key IS NOT NULL AND photo_content_type IS NOT NULL",
        )
        .bind(&profile_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow!("No photo found for this profile"))?;

        Ok((url, content_type))
    }

    pub async fn get_public_image(&self, slug: &str, image_id: &str) -> Result<(String, String)> {
        let profile_id = self.get_published_profile_id(slug).await?;

        let (url, content_type): (String, String) = sqlx::query_as(
            "SELECT storage_key, content_type FROM profile_image
             WHERE id = $1 AND profile_id = $2",
        )
        .bind(image_id)
        .bind(&profile_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow!("Image not found"))?;

        Ok((url, content_type))
    }
}
