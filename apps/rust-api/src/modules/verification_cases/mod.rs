//! Verification Cases module — replaces apps/api/src/modules/verification-cases/.
//!
//! Handles verification case creation, listing, retrieval, resolution,
//! and various submission methods (OTP, documents, claims).
//! Mirrors the TypeScript VerificationCasesController and VerificationCasesService.

pub mod service;
pub mod handlers;
pub mod routes;
pub mod dto;
