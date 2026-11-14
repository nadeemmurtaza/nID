//! Profiles service.

use anyhow::{anyhow, Result};
use deadpool_postgres::Object;
use sqlx::{FromRow, Row};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::profiles::dto::ProfileResponse;

#[derive(Debug, Clone, FromRow)]
pub struct ProfileRow {
    pub id: String,
    pub account_id: String,
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub website: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub struct ProfilesService {
    db: DbPool,
    env: AppEnv,
}

impl ProfilesService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    fn row_to_response(row: ProfileRow) -> ProfileResponse {
        ProfileResponse {
            id: row.id,
            account_id: row.account_id,
            display_name: row.display_name,
            bio: row.bio,
            avatar_url: row.avatar_url,
            website: row.website,
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
        }
    }

    pub async fn get_by_account(&self, account_id: &str) -> Result<ProfileResponse> {
        let conn = self.db.get().await?;

        let profile: ProfileRow = sqlx::query_as(
            "SELECT id, account_id, display_name, bio, avatar_url, website, created_at, updated_at FROM profile WHERE account_id = $1",
        )
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Profile not found"))?;

        Ok(Self::row_to_response(profile))
    }

    pub async fn update(
        &self,
        account_id: &str,
        req: &crate::modules::profiles::dto::UpdateProfileRequest,
    ) -> Result<ProfileResponse> {
        let conn = self.db.get().await?;

        let profile: ProfileRow = sqlx::query_as(
            r#"
            UPDATE profile SET
                display_name = COALESCE($1, display_name),
                bio = CASE WHEN $2::text IS NULL THEN bio ELSE $2 END,
                avatar_url = CASE WHEN $3::text IS NULL THEN avatar_url ELSE $3 END,
                website = CASE WHEN $4::text IS NULL THEN website ELSE $4 END
            WHERE account_id = $5
            RETURNING id, account_id, display_name, bio, avatar_url, website, created_at, updated_at
            "#,
        )
        .bind(&req.display_name)
        .bind(req.bio)
        .bind(req.avatar_url)
        .bind(req.website)
        .bind(account_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| anyhow!("Profile not found"))?;

        Ok(Self::row_to_response(profile))
    }
}
