//! Badges module — shared badge ranking and cross-tenant badge lookups.
//!
//! Mirrors `apps/api/src/modules/badges/`. Provides `pick_strongest_per_claim_type`
//! and `pick_strongest_per_attribute` used by subjects and profiles, plus
//! `CrossTenantBadgesService` for phone-based badge lookups across all tenants.

pub mod ranking;
pub mod cross_tenant;
