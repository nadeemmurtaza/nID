//! Organization Profiles module — org-owned profile management.
//!
//! Mirrors `apps/api/src/modules/profiles/organization-profiles.controller.ts`.
//! Provides profile CRUD and field-level grants for organization profiles,
//! gated by active admin membership verification.

pub mod service;
pub mod handlers;
pub mod routes;
pub mod dto;
