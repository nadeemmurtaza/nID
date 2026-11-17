//! Publish client for the identity events nID owns, per `COMMUNICATION.md`
//! section 1 ("Asynchronous: the event bus — NATS JetStream") and the
//! ownership table in that same doc (nID owns tenant_id, org_id, and
//! customer/person identity; everyone else holds a synced copy).
//!
//! **Interim, flagged, local-dev stand-in — not the real bus.**
//! `COMMUNICATION.md` is explicit that the gateway and the event bus
//! themselves belong in `core-newax`, and that nID/Communicator each need
//! only a thin client against them, not to build them. `core-newax` is not
//! reachable from this repo as of 2026-11-16 (same situation the audit note
//! in `COMMUNICATION.md` describes for the Module Gateway). This crate is
//! the same kind of deliberate, named, dated shortcut `CONVENTIONS.md`
//! requires for the `<MODULE>_SERVICE_URL` direct-dial gRPC interim: it
//! talks to *a* NATS JetStream server (local dev by default, override via
//! `NEWAX_EVENT_BUS_URL`), not to a shared production bus owned by
//! `core-newax`. When `core-newax` stands up the real bus, point
//! `NEWAX_EVENT_BUS_URL` at it and this client's subject/schema contract
//! should not need to change.
//!
//! Subjects follow `COMMUNICATION.md`'s naming rule exactly:
//! `newax.<module>.<entity>.<event>`, module = `identity` (nID's canonical
//! name), e.g. `newax.identity.tenant.updated`.

use std::sync::OnceLock;
use std::time::Duration;

use anyhow::Result;
use async_nats::jetstream;
use prost::Message;
use tracing::{debug, warn};

/// Env var overriding the NATS URL. Defaults to a local dev instance — see
/// this module's doc comment for why that's an explicitly interim choice.
pub const EVENT_BUS_URL_ENV: &str = "NEWAX_EVENT_BUS_URL";
const DEFAULT_URL: &str = "127.0.0.1:4222";

/// The one JetStream stream this crate publishes into. Subjects under
/// `newax.identity.>` are all nID-owned identity events.
pub const STREAM_NAME: &str = "NEWAX_IDENTITY";
pub const STREAM_SUBJECTS: &str = "newax.identity.>";

pub mod subjects {
    pub fn tenant(op: &str) -> String {
        format!("newax.identity.tenant.{op}")
    }
    pub fn organization(op: &str) -> String {
        format!("newax.identity.organization.{op}")
    }
    pub fn brand(op: &str) -> String {
        format!("newax.identity.brand.{op}")
    }
    pub fn customer(op: &str) -> String {
        format!("newax.identity.customer.{op}")
    }
}

/// Publishes identity-change events to NATS JetStream. Connection failure is
/// never fatal to the caller: `core-newax`'s bus genuinely may not be
/// running yet in every environment, and a tenant/org/brand/account write
/// must still succeed even if nothing is listening for its event (nID is
/// the source of truth regardless of whether the copy propagates). A
/// disconnected publisher logs a warning on each publish attempt and is a
/// no-op, not a panic or a propagated error.
pub struct EventPublisher {
    jetstream: Option<jetstream::Context>,
}

impl EventPublisher {
    /// Connects to `NEWAX_EVENT_BUS_URL` (default `127.0.0.1:4222`) and
    /// ensures the `NEWAX_IDENTITY` stream exists. On any failure, returns a
    /// disabled publisher (logs a warning) rather than failing service
    /// startup — see the struct doc comment.
    pub async fn connect() -> Self {
        let url = std::env::var(EVENT_BUS_URL_ENV).unwrap_or_else(|_| DEFAULT_URL.to_string());
        match Self::try_connect(&url).await {
            Ok(js) => {
                tracing::info!(url, stream = STREAM_NAME, "event-bus: connected");
                Self { jetstream: Some(js) }
            }
            Err(e) => {
                warn!(url, error = %e, "event-bus: could not connect, publishing is disabled for this process");
                Self { jetstream: None }
            }
        }
    }

    async fn try_connect(url: &str) -> Result<jetstream::Context> {
        let client = async_nats::connect_with_options(
            url,
            async_nats::ConnectOptions::new().connection_timeout(Duration::from_secs(3)),
        )
        .await?;
        let js = jetstream::new(client);
        js.get_or_create_stream(jetstream::stream::Config {
            name: STREAM_NAME.to_string(),
            subjects: vec![STREAM_SUBJECTS.to_string()],
            ..Default::default()
        })
        .await?;
        Ok(js)
    }

    /// Serializes `payload` with prost and publishes it to `subject`.
    /// Never returns an error to the caller — see the struct doc comment.
    pub async fn publish(&self, subject: String, payload: &impl Message) {
        let Some(js) = &self.jetstream else {
            debug!(subject, "event-bus: disabled, dropping publish");
            return;
        };
        let bytes = payload.encode_to_vec();
        if let Err(e) = js.publish(subject.clone(), bytes.into()).await {
            warn!(subject, error = %e, "event-bus: publish failed");
        }
    }
}

/// Lazily-initialized process-wide publisher, so existing `*Service::new`
/// call sites don't all need a connection handle threaded through them.
/// `connect()` itself never fails (see above), so this never panics.
static PUBLISHER: OnceLock<tokio::sync::OnceCell<EventPublisher>> = OnceLock::new();

pub async fn publisher() -> &'static EventPublisher {
    PUBLISHER
        .get_or_init(tokio::sync::OnceCell::new)
        .get_or_init(EventPublisher::connect)
        .await
}
