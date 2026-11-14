//! Organizations module — replaces apps/api/src/modules/organizations/.
//!
//! Handles organization CRUD, membership management, and beneficial owners.
//! Mirrors the TypeScript OrganizationsController and OrganizationsService.

pub mod service;
pub mod handlers;
pub mod routes;
pub mod dto;
