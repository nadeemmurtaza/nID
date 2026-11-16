//! Authentication, optional TLS and connection handling for the gRPC calls
//! between `nid-api` and the `svc-*` services.
//!
//! Without this the services trust any caller that can reach their port and
//! the `tenant_id` / `account_id` it sends (SECURITY_RULES.md item 9).
//!
//! Configuration (all via environment):
//! - `SERVICE_AUTH_TOKEN`: shared secret. Clients send it as
//!   `authorization: Bearer <token>`; services reject calls without it. When
//!   a service is bound to anything but loopback it is mandatory and the
//!   service refuses to start without it.
//! - `SERVICE_TLS_CERT` / `SERVICE_TLS_KEY` (service side, PEM files) and
//!   `SERVICE_TLS_CA` (client side, PEM, plus `SERVICE_TLS_DOMAIN` for the
//!   name on the certificate, default `localhost`): encrypt the hop. Use
//!   `https://` service URLs when enabled.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use once_cell::sync::Lazy;
use tonic::metadata::MetadataValue;
use tonic::service::interceptor::InterceptedService;
use tonic::service::Interceptor;
use tonic::transport::{Certificate, Channel, ClientTlsConfig, Endpoint, Identity, Server, ServerTlsConfig};
use tonic::{Request, Status};

pub type AuthedChannel = InterceptedService<Channel, ClientAuth>;

/// Adds the shared token to every outgoing call.
#[derive(Clone)]
pub struct ClientAuth {
    header: Option<MetadataValue<tonic::metadata::Ascii>>,
}

impl ClientAuth {
    fn from_env() -> Self {
        let header = std::env::var("SERVICE_AUTH_TOKEN")
            .ok()
            .filter(|t| !t.is_empty())
            .and_then(|t| format!("Bearer {t}").parse().ok());
        Self { header }
    }
}

impl Interceptor for ClientAuth {
    fn call(&mut self, mut req: Request<()>) -> Result<Request<()>, Status> {
        if let Some(h) = &self.header {
            req.metadata_mut().insert("authorization", h.clone());
        }
        Ok(req)
    }
}

static CHANNELS: Lazy<Mutex<HashMap<String, Channel>>> = Lazy::new(|| Mutex::new(HashMap::new()));

/// A channel to `url`, created once and shared: HTTP/2 multiplexes calls over
/// one connection, so a request no longer pays for a new TCP connection, and
/// every call has a timeout. The connection is made lazily and re-made if it
/// drops, so a service that restarts is picked up on the next call.
pub async fn connect(url: String) -> Result<AuthedChannel, anyhow::Error> {
    let cached = CHANNELS.lock().map_err(|_| anyhow::anyhow!("channel cache poisoned"))?.get(&url).cloned();
    let channel = match cached {
        Some(c) => c,
        None => {
            let mut endpoint = Endpoint::from_shared(url.clone())?
                .connect_timeout(Duration::from_secs(3))
                .timeout(Duration::from_secs(30))
                .tcp_keepalive(Some(Duration::from_secs(30)));
            if let Ok(ca_path) = std::env::var("SERVICE_TLS_CA") {
                let ca = std::fs::read(&ca_path).map_err(|e| anyhow::anyhow!("reading SERVICE_TLS_CA {ca_path}: {e}"))?;
                let domain = std::env::var("SERVICE_TLS_DOMAIN").unwrap_or_else(|_| "localhost".to_string());
                endpoint = endpoint.tls_config(
                    ClientTlsConfig::new().ca_certificate(Certificate::from_pem(ca)).domain_name(domain),
                )?;
            }
            let c = endpoint.connect_lazy();
            CHANNELS.lock().map_err(|_| anyhow::anyhow!("channel cache poisoned"))?.insert(url, c.clone());
            c
        }
    };
    Ok(InterceptedService::new(channel, ClientAuth::from_env()))
}

/// Rejects calls that do not carry the shared token.
#[derive(Clone)]
pub struct ServerAuth {
    token: Option<String>,
}

impl ServerAuth {
    /// Read `SERVICE_AUTH_TOKEN`. `bind` is the address the service listens
    /// on: an unauthenticated service is only allowed on loopback.
    pub fn from_env(bind: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let token = std::env::var("SERVICE_AUTH_TOKEN").ok().filter(|t| !t.is_empty());
        let loopback = bind == "127.0.0.1" || bind == "::1" || bind == "localhost";
        if token.is_none() {
            if !loopback {
                return Err("SERVICE_AUTH_TOKEN must be set when BIND_ADDR is not loopback".into());
            }
            tracing::warn!("SERVICE_AUTH_TOKEN is not set: this service accepts unauthenticated calls (loopback only)");
        }
        Ok(Self { token })
    }
}

impl Interceptor for ServerAuth {
    fn call(&mut self, req: Request<()>) -> Result<Request<()>, Status> {
        let Some(expected) = &self.token else { return Ok(req) };
        let supplied = req
            .metadata()
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .unwrap_or("");
        if constant_time_eq(supplied.as_bytes(), expected.as_bytes()) {
            Ok(req)
        } else {
            Err(Status::unauthenticated("missing or invalid service credentials"))
        }
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// A server builder with TLS applied when `SERVICE_TLS_CERT` and
/// `SERVICE_TLS_KEY` are set.
pub fn server_builder() -> Result<Server, Box<dyn std::error::Error>> {
    let mut builder = Server::builder();
    if let (Ok(cert), Ok(key)) = (std::env::var("SERVICE_TLS_CERT"), std::env::var("SERVICE_TLS_KEY")) {
        let identity = Identity::from_pem(std::fs::read(&cert)?, std::fs::read(&key)?);
        builder = builder.tls_config(ServerTlsConfig::new().identity(identity))?;
        tracing::info!("gRPC TLS enabled");
    }
    Ok(builder)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req_with(auth: Option<&str>) -> Request<()> {
        let mut r = Request::new(());
        if let Some(a) = auth {
            r.metadata_mut().insert("authorization", a.parse().unwrap());
        }
        r
    }

    #[test]
    fn accepts_only_the_exact_token() {
        let mut s = ServerAuth { token: Some("secret".into()) };
        assert!(s.call(req_with(Some("Bearer secret"))).is_ok());
        assert!(s.call(req_with(Some("Bearer secreT"))).is_err());
        assert!(s.call(req_with(Some("Bearer secre"))).is_err());
        assert!(s.call(req_with(Some("secret"))).is_err());
        assert!(s.call(req_with(None)).is_err());
    }

    #[test]
    fn no_token_configured_allows_calls() {
        let mut s = ServerAuth { token: None };
        assert!(s.call(req_with(None)).is_ok());
    }

    #[test]
    fn refuses_to_start_unauthenticated_off_loopback() {
        // from_env reads the process environment; only exercise the loopback rule here.
        std::env::remove_var("SERVICE_AUTH_TOKEN");
        assert!(ServerAuth::from_env("0.0.0.0").is_err());
        assert!(ServerAuth::from_env("127.0.0.1").is_ok());
    }
}
