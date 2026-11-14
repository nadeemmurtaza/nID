//! Tenants module — replaces apps/api/src/modules/tenants/.
//!
//! Handles tenant CRUD, API key management, and staff management.
//! Mirrors the TypeScript TenantsController and TenantsService.

pub mod service;
pub mod handlers;
pub mod routes;
pub mod dto;
