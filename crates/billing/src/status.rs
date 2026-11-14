//! Subscription and billing status types.

use serde::{Deserialize, Serialize};
use strum::Display;

/// The current status of a subscription.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Display)]
pub enum SubscriptionStatus {
    Active,
    PastDue,
    Cancelled,
    Unpaid,
    Trialing,
    Paused,
}

/// The billing period for a subscription.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Display)]
#[serde(rename_all = "snake_case")]
pub enum BillingPeriod {
    Monthly,
    Yearly,
}
