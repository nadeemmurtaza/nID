//! API modules — each domain area maps to one module.
//!
//! Mirrors the NestJS module structure in apps/api/src/modules/.

pub mod accounts;
pub mod tenants;
pub mod subjects;
pub mod verification_cases;
pub mod organizations;
pub mod sessions;
pub mod brands;
pub mod profiles;
pub mod access;
pub mod roles;
pub mod permissions;
pub mod departments;
pub mod invitations;
pub mod tenant_staff;
pub mod account_verification;
pub mod oauth;
pub mod booking;
pub mod profile_content;
