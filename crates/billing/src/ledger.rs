//! Ledger entry types for double-entry bookkeeping.

use chrono::DateTime;
use uuid::Uuid;

use crate::money::Currency;

/// A single ledger entry in the double-entry system.
#[derive(Debug, Clone)]
pub struct LedgerEntry {
    pub id: Uuid,
    pub tenant_id: String,
    pub account_id: String,
    pub entry_type: LedgerEntryType,
    pub amount: i64,
    pub currency: Currency,
    pub description: String,
    pub reference_id: Option<String>,
    pub created_at: DateTime<chrono::Utc>,
}

/// The type of ledger entry.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum LedgerEntryType {
    Charge,
    Credit,
    Refund,
    Adjustment,
    Payout,
}
