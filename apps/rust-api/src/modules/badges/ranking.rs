//! Badge ranking functions — strongest-per-key deduplication.
//!
//! Mirrors `apps/api/src/modules/badges/badge-ranking.ts`.
//! Callers must pass evidence already ordered strongest-first per key
//! (Postgres orders VerificationLevel by declaration order, so
//! `ORDER BY level DESC` produces the correct order).

use serde::Serialize;

/// A badge for a whole VerificationCase outcome (claimType + level).
#[derive(Debug, Clone, Serialize)]
pub struct Badge {
    pub claim_type: String,
    pub level: String,
    pub verified_at: Option<String>,
    pub case_id: Option<String>,
}

/// Input evidence for claim-type badge ranking.
#[derive(Debug, Clone)]
pub struct RankableEvidence {
    pub claim_type: String,
    pub level: String,
    pub verified_at: Option<String>,
    pub case_id: Option<String>,
}

/// A badge for a single real-world fact (NAME, PHONE, EMAIL, etc.).
#[derive(Debug, Clone, Serialize)]
pub struct AttributeBadge {
    pub attribute: String,
    pub level: String,
    pub verified_at: Option<String>,
    pub case_id: Option<String>,
    pub method: Option<String>,
}

/// Input evidence for attribute badge ranking.
#[derive(Debug, Clone)]
pub struct RankableAttributeEvidence {
    pub attribute: String,
    pub level: String,
    pub verified_at: Option<String>,
    pub case_id: Option<String>,
    pub method: Option<String>,
}

/// Pick the strongest badge per claim type.
///
/// Evidence must be ordered strongest-first per claimType.
/// The first row seen for each claimType wins.
pub fn pick_strongest_per_claim_type(evidence: Vec<RankableEvidence>) -> Vec<Badge> {
    let mut seen = std::collections::HashSet::new();
    evidence
        .into_iter()
        .filter(|e| seen.insert(e.claim_type.clone()))
        .map(|e| Badge {
            claim_type: e.claim_type,
            level: e.level,
            verified_at: e.verified_at,
            case_id: e.case_id,
        })
        .collect()
}

/// Pick the strongest badge per attribute.
///
/// Evidence must be ordered strongest-first per attribute.
/// The first row seen for each attribute wins.
pub fn pick_strongest_per_attribute(evidence: Vec<RankableAttributeEvidence>) -> Vec<AttributeBadge> {
    let mut seen = std::collections::HashSet::new();
    evidence
        .into_iter()
        .filter(|e| seen.insert(e.attribute.clone()))
        .map(|e| AttributeBadge {
            attribute: e.attribute,
            level: e.level,
            verified_at: e.verified_at,
            case_id: e.case_id,
            method: e.method,
        })
        .collect()
}
