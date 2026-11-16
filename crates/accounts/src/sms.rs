//! SMS delivery for login codes through Twilio's REST API.
//!
//! Configuration (environment):
//! - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`: credentials.
//! - `TWILIO_FROM` (a sender number) or `TWILIO_MESSAGING_SERVICE_SID`.
//! - `SMS_API_BASE`: defaults to `https://api.twilio.com`; overridable so the
//!   request can be pointed at a test double.
//!
//! The message body, which contains the code, is never written to logs.

use anyhow::{anyhow, Result};
use std::time::Duration;

pub struct SmsConfig {
    account_sid: String,
    auth_token: String,
    sender: Sender,
    api_base: String,
}

enum Sender {
    From(String),
    MessagingService(String),
}

impl SmsConfig {
    pub fn from_env() -> Result<Self> {
        let account_sid = std::env::var("TWILIO_ACCOUNT_SID").map_err(|_| anyhow!("SMS is not configured: TWILIO_ACCOUNT_SID is not set"))?;
        let auth_token = std::env::var("TWILIO_AUTH_TOKEN").map_err(|_| anyhow!("SMS is not configured: TWILIO_AUTH_TOKEN is not set"))?;
        let sender = match (std::env::var("TWILIO_MESSAGING_SERVICE_SID"), std::env::var("TWILIO_FROM")) {
            (Ok(sid), _) if !sid.is_empty() => Sender::MessagingService(sid),
            (_, Ok(from)) if !from.is_empty() => Sender::From(from),
            _ => return Err(anyhow!("SMS is not configured: set TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID")),
        };
        let api_base = std::env::var("SMS_API_BASE").unwrap_or_else(|_| "https://api.twilio.com".to_string());
        Ok(Self { account_sid, auth_token, sender, api_base })
    }

    pub async fn send(&self, to: &str, body: &str) -> Result<()> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()?;
        let mut form = vec![("To", to.to_string()), ("Body", body.to_string())];
        match &self.sender {
            Sender::From(f) => form.push(("From", f.clone())),
            Sender::MessagingService(s) => form.push(("MessagingServiceSid", s.clone())),
        }
        let url = format!("{}/2010-04-01/Accounts/{}/Messages.json", self.api_base.trim_end_matches('/'), self.account_sid);
        let resp = client
            .post(url)
            .basic_auth(&self.account_sid, Some(&self.auth_token))
            .form(&form)
            .send()
            .await
            .map_err(|e| anyhow!("SMS provider unreachable: {}", e.without_url()))?;
        if !resp.status().is_success() {
            // Log the status only: the response can echo the recipient and body.
            return Err(anyhow!("SMS provider rejected the message (HTTP {})", resp.status().as_u16()));
        }
        Ok(())
    }
}
