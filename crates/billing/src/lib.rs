//! Billing domain types for nID.
//!
//! Mirrors `packages/billing` from the TypeScript codebase.
//! Provides money amounts, ledger entries, and billing status types.

pub mod money;
pub mod ledger;
pub mod status;

pub use money::{Money, Currency};
pub use ledger::{LedgerEntry, LedgerEntryType};
pub use status::{SubscriptionStatus, BillingPeriod};
