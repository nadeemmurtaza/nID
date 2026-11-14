//! Cross-tenant badges service — phone-based badge lookups across all tenants.
//!
//! Mirrors `apps/api/src/modules/badges/cross-tenant-badges.service.ts`.
//! PhoneBadgeEvidence carries no RLS policy (same trust domain as Account),
//! so this reads directly without tenant context.

use anyhow::Result;
use sqlx::Row;

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::badges::ranking::{
    Badge, RankableEvidence, pick_strongest_per_claim_type,
};

pub struct CrossTenantBadgesService {
    db: DbPool,
    env: AppEnv,
}

impl CrossTenantBadgesService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    /// Get badges for a phone number, across all tenants.
    ///
    /// Reads from the denormalized phone_badge_evidence table instead of
    /// joining Subject/VerificationCase across tenants.
    pub async fn get_badges_for_phone(&self, phone: &str) -> Result<Vec<Badge>> {
        let conn = self.db.get().await?;

        let rows = sqlx::query(
            "SELECT claim_type, level, verified_at, case_id FROM phone_badge_evidence WHERE phone = $1 ORDER BY level DESC, verified_at DESC",
        )
        .bind(phone)
        .fetch_all(&mut *conn)
        .await?;

        let evidence: Vec<RankableEvidence> = rows
            .into_iter()
            .map(|row| RankableEvidence {
                claim_type: row.get("claim_type"),
                level: row.get("level"),
                verified_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("verified_at")
                    .map(|d| d.to_rfc3339()),
                case_id: row.get("case_id"),
            })
            .collect();

        Ok(pick_strongest_per_claim_type(evidence))
    }

    /// Check if a phone has an IDENTITY badge (verified real name).
    pub async fn has_identity_badge(&self, phone: &str) -> Result<bool> {
        let badges = self.get_badges_for_phone(phone).await?;
        Ok(badges.iter().any(|b| b.claim_type == "IDENTITY"))
    }
}
