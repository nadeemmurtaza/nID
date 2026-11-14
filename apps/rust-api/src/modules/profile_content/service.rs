//! Profile content service — business logic for profile content operations.

use anyhow::{anyhow, Result};
use sqlx::{FromRow, Row};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::profile_content::dto::{
    BusinessHourResponse, ContactMessageResponse, CustomLinkResponse, OfferResponse,
    SocialLinkResponse,
};

pub struct ProfileContentService {
    db: DbPool,
    env: AppEnv,
}

impl ProfileContentService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    fn get_profile_id(&self, account_id: &str) -> impl std::future::Future<Output = Result<String>> + '_ {
        async move {
            let mut conn = self.db.get().await?;
            let profile_id = sqlx::query("SELECT id FROM profile WHERE account_id = $1 LIMIT 1")
                .bind(account_id)
                .fetch_optional(&mut *conn)
                .await?
                .map(|r| r.get::<String, _>("id"))
                .ok_or_else(|| anyhow!("No profile found for this account"))?;
            Ok(profile_id)
        }
    }

    fn get_published_profile_id(&self, slug: &str) -> impl std::future::Future<Output = Result<String>> + '_ {
        async move {
            let mut conn = self.db.get().await?;
            let profile_id = sqlx::query("SELECT id FROM profile WHERE slug = $1 AND is_published = true LIMIT 1")
                .bind(slug)
                .fetch_optional(&mut *conn)
                .await?
                .map(|r| r.get::<String, _>("id"))
                .ok_or_else(|| anyhow!("No published profile at this URL"))?;
            Ok(profile_id)
        }
    }

    // ── Offers ──

    pub async fn create_offer(
        &self,
        account_id: &str,
        req: &crate::modules::profile_content::dto::CreateOfferRequest,
    ) -> Result<OfferResponse> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let offer: (String, String, String, i64, String, Option<String>, bool) = sqlx::query_as(
            r#"
            INSERT INTO offer (id, profile_id, title, price_minor, currency, description)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
            RETURNING id, profile_id, title, price_minor, currency, description, is_active
            "#,
        )
        .bind(&profile_id)
        .bind(&req.title)
        .bind(req.price_minor)
        .bind(&req.currency)
        .bind(&req.description)
        .fetch_one(&mut *conn)
        .await?;

        Ok(OfferResponse {
            id: offer.0, profile_id: offer.1, title: offer.2,
            price_minor: offer.3, currency: offer.4, description: offer.5, is_active: offer.6,
        })
    }

    pub async fn list_my_offers(&self, account_id: &str) -> Result<Vec<OfferResponse>> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let rows: Vec<(String, String, String, i64, String, Option<String>, bool)> = sqlx::query_as(
            "SELECT id, profile_id, title, price_minor, currency, description, is_active FROM offer WHERE profile_id = $1 ORDER BY title",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| OfferResponse {
            id: r.0, profile_id: r.1, title: r.2, price_minor: r.3,
            currency: r.4, description: r.5, is_active: r.6,
        }).collect())
    }

    pub async fn update_offer(
        &self,
        account_id: &str,
        offer_id: &str,
        req: &crate::modules::profile_content::dto::UpdateOfferRequest,
    ) -> Result<OfferResponse> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let mut sets = Vec::new();
        let mut title_val: Option<String> = None;
        let mut price_val: Option<i64> = None;
        let mut active_val: Option<bool> = None;

        if let Some(ref t) = req.title {
            sets.push("title = $1");
            title_val = Some(t.clone());
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
            return self.get_offer(&profile_id, offer_id).await;
        }

        let offer: (String, String, String, i64, String, Option<String>, bool) = sqlx::query_as(
            &format!(
                "UPDATE offer SET {} WHERE id = ${} AND profile_id = ${} RETURNING id, profile_id, title, price_minor, currency, description, is_active",
                sets.join(", "),
                sets.len() + 1,
                sets.len() + 2,
            ),
        )
        .bind(&title_val)
        .bind(&price_val)
        .bind(&active_val)
        .bind(offer_id)
        .bind(&profile_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Offer not found"))?;

        Ok(OfferResponse {
            id: offer.0, profile_id: offer.1, title: offer.2, price_minor: offer.3,
            currency: offer.4, description: offer.5, is_active: offer.6,
        })
    }

    pub async fn remove_offer(&self, account_id: &str, offer_id: &str) -> Result<()> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let result = sqlx::query("DELETE FROM offer WHERE id = $1 AND profile_id = $2")
            .bind(offer_id)
            .bind(&profile_id)
            .execute(&mut *conn)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Offer not found."));
        }
        Ok(())
    }

    async fn get_offer(&self, profile_id: &str, offer_id: &str) -> Result<OfferResponse> {
        let mut conn = self.db.get().await?;

        let offer: (String, String, String, i64, String, Option<String>, bool) = sqlx::query_as(
            "SELECT id, profile_id, title, price_minor, currency, description, is_active FROM offer WHERE id = $1 AND profile_id = $2",
        )
        .bind(offer_id)
        .bind(profile_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Offer not found"))?;

        Ok(OfferResponse {
            id: offer.0, profile_id: offer.1, title: offer.2, price_minor: offer.3,
            currency: offer.4, description: offer.5, is_active: offer.6,
        })
    }

    // ── Business Hours ──

    pub async fn upsert_business_hour(
        &self,
        account_id: &str,
        day: &str,
        req: &crate::modules::profile_content::dto::UpsertBusinessHourRequest,
    ) -> Result<BusinessHourResponse> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let hour: (String, String, String, String, String, bool) = sqlx::query_as(
            r#"
            INSERT INTO business_hour (id, profile_id, weekday, start_time, end_time, is_closed)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
            ON CONFLICT (profile_id, weekday) DO UPDATE SET start_time = $3, end_time = $4, is_closed = $5
            RETURNING id, profile_id, weekday, start_time, end_time, is_closed
            "#,
        )
        .bind(&profile_id)
        .bind(day)
        .bind(&req.start_time)
        .bind(&req.end_time)
        .bind(req.is_closed)
        .fetch_one(&mut *conn)
        .await?;

        Ok(BusinessHourResponse {
            id: hour.0, profile_id: hour.1, weekday: hour.2,
            start_time: hour.3, end_time: hour.4, is_closed: hour.5,
        })
    }

    pub async fn list_my_business_hours(&self, account_id: &str) -> Result<Vec<BusinessHourResponse>> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let rows: Vec<(String, String, String, String, String, bool)> = sqlx::query_as(
            "SELECT id, profile_id, weekday, start_time, end_time, is_closed FROM business_hour WHERE profile_id = $1 ORDER BY weekday",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| BusinessHourResponse {
            id: r.0, profile_id: r.1, weekday: r.2, start_time: r.3, end_time: r.4, is_closed: r.5,
        }).collect())
    }

    pub async fn remove_business_hour(&self, account_id: &str, day: &str) -> Result<()> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let result = sqlx::query("DELETE FROM business_hour WHERE profile_id = $1 AND weekday = $2")
            .bind(&profile_id)
            .bind(day)
            .execute(&mut *conn)
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
        req: &crate::modules::profile_content::dto::CreateCustomLinkRequest,
    ) -> Result<CustomLinkResponse> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let link: (String, String, String, String, i32) = sqlx::query_as(
            r#"
            INSERT INTO custom_link (id, profile_id, label, url, r#order)
            VALUES (gen_random_uuid(), $1, $2, $3, $4)
            RETURNING id, profile_id, label, url, r#order
            "#,
        )
        .bind(&profile_id)
        .bind(&req.label)
        .bind(&req.url)
        .bind(req.order.unwrap_or(0))
        .fetch_one(&mut *conn)
        .await?;

        Ok(CustomLinkResponse {
            id: link.0, profile_id: link.1, label: link.2, url: link.3, order: link.4,
        })
    }

    pub async fn list_my_custom_links(&self, account_id: &str) -> Result<Vec<CustomLinkResponse>> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let rows: Vec<(String, String, String, String, i32)> = sqlx::query_as(
            "SELECT id, profile_id, label, url, r#order FROM custom_link WHERE profile_id = $1 ORDER BY r#order",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| CustomLinkResponse {
            id: r.0, profile_id: r.1, label: r.2, url: r.3, order: r.4,
        }).collect())
    }

    pub async fn remove_custom_link(&self, account_id: &str, link_id: &str) -> Result<()> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let result = sqlx::query("DELETE FROM custom_link WHERE id = $1 AND profile_id = $2")
            .bind(link_id)
            .bind(&profile_id)
            .execute(&mut *conn)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Link not found."));
        }
        Ok(())
    }

    // ── Social Links ──

    pub async fn create_social_link(
        &self,
        account_id: &str,
        req: &crate::modules::profile_content::dto::CreateSocialLinkRequest,
    ) -> Result<SocialLinkResponse> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let link: (String, String, String, String, Option<String>) = sqlx::query_as(
            r#"
            INSERT INTO social_link (id, profile_id, platform, username, url)
            VALUES (gen_random_uuid(), $1, $2, $3, $4)
            RETURNING id, profile_id, platform, username, url
            "#,
        )
        .bind(&profile_id)
        .bind(&req.platform)
        .bind(&req.username)
        .bind(&req.url)
        .fetch_one(&mut *conn)
        .await?;

        Ok(SocialLinkResponse {
            id: link.0, profile_id: link.1, platform: link.2, username: link.3, url: link.4,
        })
    }

    pub async fn list_my_social_links(&self, account_id: &str) -> Result<Vec<SocialLinkResponse>> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let rows: Vec<(String, String, String, String, Option<String>)> = sqlx::query_as(
            "SELECT id, profile_id, platform, username, url FROM social_link WHERE profile_id = $1 ORDER BY platform",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| SocialLinkResponse {
            id: r.0, profile_id: r.1, platform: r.2, username: r.3, url: r.4,
        }).collect())
    }

    pub async fn remove_social_link(&self, account_id: &str, link_id: &str) -> Result<()> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let result = sqlx::query("DELETE FROM social_link WHERE id = $1 AND profile_id = $2")
            .bind(link_id)
            .bind(&profile_id)
            .execute(&mut *conn)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Link not found."));
        }
        Ok(())
    }

    // ── Contact Messages ──

    pub async fn list_my_contact_messages(&self, account_id: &str) -> Result<Vec<ContactMessageResponse>> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let rows: Vec<(String, String, String, String, String, bool, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
            "SELECT id, profile_id, name, email, message, is_read, created_at FROM contact_message WHERE profile_id = $1 ORDER BY created_at DESC",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| ContactMessageResponse {
            id: r.0, profile_id: r.1, name: r.2, email: r.3, message: r.4,
            is_read: r.5, created_at: r.6.to_rfc3339(),
        }).collect())
    }

    pub async fn mark_contact_message_read(&self, account_id: &str, message_id: &str) -> Result<ContactMessageResponse> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_profile_id(account_id).await?;

        let msg: (String, String, String, String, String, bool, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
            "UPDATE contact_message SET is_read = true WHERE id = $1 AND profile_id = $2 RETURNING id, profile_id, name, email, message, is_read, created_at",
        )
        .bind(message_id)
        .bind(&profile_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Message not found"))?;

        Ok(ContactMessageResponse {
            id: msg.0, profile_id: msg.1, name: msg.2, email: msg.3, message: msg.4,
            is_read: msg.5, created_at: msg.6.to_rfc3339(),
        })
    }

    pub async fn create_public_contact_message(
        &self,
        slug: &str,
        req: &crate::modules::profile_content::dto::CreateContactMessageRequest,
    ) -> Result<ContactMessageResponse> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_published_profile_id(slug).await?;

        let msg: (String, String, String, String, String, bool, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
            r#"
            INSERT INTO contact_message (id, profile_id, name, email, message)
            VALUES (gen_random_uuid(), $1, $2, $3, $4)
            RETURNING id, profile_id, name, email, message, is_read, created_at
            "#,
        )
        .bind(&profile_id)
        .bind(&req.name)
        .bind(&req.email)
        .bind(&req.message)
        .fetch_one(&mut *conn)
        .await?;

        Ok(ContactMessageResponse {
            id: msg.0, profile_id: msg.1, name: msg.2, email: msg.3, message: msg.4,
            is_read: msg.5, created_at: msg.6.to_rfc3339(),
        })
    }

    // ── Public endpoints ──

    pub async fn list_public_offers(&self, slug: &str) -> Result<Vec<OfferResponse>> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_published_profile_id(slug).await?;

        let rows: Vec<(String, String, String, i64, String, Option<String>, bool)> = sqlx::query_as(
            "SELECT id, profile_id, title, price_minor, currency, description, is_active FROM offer WHERE profile_id = $1 AND is_active = true ORDER BY title",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| OfferResponse {
            id: r.0, profile_id: r.1, title: r.2, price_minor: r.3,
            currency: r.4, description: r.5, is_active: r.6,
        }).collect())
    }

    pub async fn list_public_business_hours(&self, slug: &str) -> Result<Vec<BusinessHourResponse>> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_published_profile_id(slug).await?;

        let rows: Vec<(String, String, String, String, String, bool)> = sqlx::query_as(
            "SELECT id, profile_id, weekday, start_time, end_time, is_closed FROM business_hour WHERE profile_id = $1 ORDER BY weekday",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(|r| BusinessHourResponse {
            id: r.0, profile_id: r.1, weekday: r.2, start_time: r.3, end_time: r.4, is_closed: r.5,
        }).collect())
    }

    pub async fn list_public_links(&self, slug: &str) -> Result<(Vec<CustomLinkResponse>, Vec<SocialLinkResponse>)> {
        let mut conn = self.db.get().await?;
        let profile_id = self.get_published_profile_id(slug).await?;

        let custom: Vec<(String, String, String, String, i32)> = sqlx::query_as(
            "SELECT id, profile_id, label, url, r#order FROM custom_link WHERE profile_id = $1 ORDER BY r#order",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        let social: Vec<(String, String, String, String, Option<String>)> = sqlx::query_as(
            "SELECT id, profile_id, platform, username, url FROM social_link WHERE profile_id = $1 ORDER BY platform",
        )
        .bind(&profile_id)
        .fetch_all(&mut *conn)
        .await?;

        let custom_links = custom.into_iter().map(|r| CustomLinkResponse {
            id: r.0, profile_id: r.1, label: r.2, url: r.3, order: r.4,
        }).collect();

        let social_links = social.into_iter().map(|r| SocialLinkResponse {
            id: r.0, profile_id: r.1, platform: r.2, username: r.3, url: r.4,
        }).collect();

        Ok((custom_links, social_links))
    }
}
