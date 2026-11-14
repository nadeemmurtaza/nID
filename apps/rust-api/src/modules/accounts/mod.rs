//! Accounts module — replaces apps/api/src/modules/accounts/.
//!
//! Handles account creation via OTP, session management, and email verification.
//! Mirrors the TypeScript AccountsController and AccountsService.

pub mod service;
pub mod handlers;
pub mod routes;
pub mod dto;
