//! Currency codes following ISO 4217.

use serde::{Deserialize, Serialize};
use strum::Display;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display)]
#[serde(rename_all = "UPPERCASE")]
#[strum(serialize_all = "UPPERCASE")]
pub enum Currency {
    USD,
    EUR,
    GBP,
    PKR,
    INR,
    AED,
    SAR,
    JPY,
    CNY,
    Other(String),
}

impl Default for Currency {
    fn default() -> Self {
        Self::USD
    }
}
