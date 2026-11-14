//! Access Control module — replaces apps/api/src/modules/access/.
//!
//! Handles access grants, ownership transfer, partnerships, and permission queries.
//! Mirrors the TypeScript AccessController and AccessService.

pub mod service;
pub mod handlers;
pub mod routes;
pub mod dto;
