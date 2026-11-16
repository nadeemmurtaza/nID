//! Shared rate limiting.
//!
//! Counters live in Redis, so every instance of every service enforces one
//! limit instead of each keeping its own. The algorithm is a sliding-window
//! counter (this window's hits plus the previous window's, weighted by how
//! much of it still overlaps), run as one Lua script so the check and the
//! increment are atomic and cannot race across instances.
//!
//! Failure policy: if Redis is unreachable the limiter falls back to an
//! in-process counter with the same limits. It never fails open.

use redis::aio::ConnectionManager;
use redis::Script;
use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const SLIDING_WINDOW: &str = r#"
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[1])
local idx = math.floor(now / window)
local cur = KEYS[1] .. ':' .. idx
local prev = KEYS[1] .. ':' .. (idx - 1)
local c = redis.call('INCR', cur)
if c == 1 then redis.call('PEXPIRE', cur, window * 2) end
local p = tonumber(redis.call('GET', prev) or '0')
local elapsed = now - idx * window
local weighted = p * (window - elapsed) / window + c
local allowed = 1
if weighted > limit then allowed = 0 end
return {allowed, math.ceil(weighted), window - elapsed}
"#;

#[derive(Debug, Clone, Copy)]
pub struct Decision {
    pub allowed: bool,
    pub limit: u32,
    pub remaining: u32,
    /// Seconds until a rejected caller should retry.
    pub retry_after: u64,
}

pub struct RateLimiter {
    redis: Option<ConnectionManager>,
    prefix: String,
    script: Script,
    local: Mutex<HashMap<String, (u64, u32, u32)>>, // key -> (window index, current, previous)
    started: Instant,
}

impl RateLimiter {
    /// `url` None gives an in-process limiter (development, tests). With a
    /// URL, an unreachable Redis is an error so production cannot start
    /// silently unprotected.
    pub async fn connect(url: Option<&str>, prefix: &str) -> Result<Self, redis::RedisError> {
        let redis = match url {
            Some(u) if !u.trim().is_empty() => {
                let client = redis::Client::open(u)?;
                Some(ConnectionManager::new(client).await?)
            }
            _ => None,
        };
        Ok(Self {
            redis,
            prefix: prefix.to_string(),
            script: Script::new(SLIDING_WINDOW),
            local: Mutex::new(HashMap::new()),
            started: Instant::now(),
        })
    }

    pub fn is_shared(&self) -> bool {
        self.redis.is_some()
    }

    /// Count one hit against `scope` + `key` and say whether it is allowed.
    pub async fn hit(&self, scope: &str, key: &str, limit: u32, window: Duration) -> Decision {
        let limit = limit.max(1);
        if let Some(conn) = &self.redis {
            let mut conn = conn.clone();
            let k = format!("{}:rl:{}:{}", self.prefix, scope, key);
            let res: Result<(i64, i64, i64), _> = self
                .script
                .key(&k)
                .arg(limit)
                .arg(window.as_millis() as u64)
                .invoke_async(&mut conn)
                .await;
            match res {
                Ok((allowed, used, retry_ms)) => {
                    return Decision {
                        allowed: allowed == 1,
                        limit,
                        remaining: limit.saturating_sub(used.max(0) as u32),
                        retry_after: ((retry_ms.max(0) as u64) + 999) / 1000,
                    }
                }
                Err(e) => tracing::warn!(error = %e, scope, "rate-limit store unreachable, using the in-process counter"),
            }
        }
        self.hit_local(scope, key, limit, window)
    }

    fn hit_local(&self, scope: &str, key: &str, limit: u32, window: Duration) -> Decision {
        let win_ms = window.as_millis().max(1) as u64;
        let now_ms = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
        let idx = now_ms / win_ms;
        let elapsed = now_ms - idx * win_ms;
        let mut map = self.local.lock().unwrap_or_else(|p| p.into_inner());
        if map.len() > 100_000 {
            map.retain(|_, (i, _, _)| *i + 1 >= idx);
        }
        let e = map.entry(format!("{scope}:{key}")).or_insert((idx, 0, 0));
        if e.0 != idx {
            // Roll forward: the old current becomes previous only if adjacent.
            e.2 = if e.0 + 1 == idx { e.1 } else { 0 };
            e.1 = 0;
            e.0 = idx;
        }
        e.1 += 1;
        let weighted = e.2 as f64 * (win_ms - elapsed) as f64 / win_ms as f64 + e.1 as f64;
        Decision {
            allowed: weighted <= limit as f64,
            limit,
            remaining: limit.saturating_sub(weighted.ceil() as u32),
            retry_after: ((win_ms - elapsed) + 999) / 1000,
        }
    }

    /// Temporarily ban `key` in `scope` (used after repeated auth failures).
    pub async fn block(&self, scope: &str, key: &str, for_: Duration) {
        let k = format!("{}:block:{}:{}", self.prefix, scope, key);
        if let Some(conn) = &self.redis {
            let mut conn = conn.clone();
            let r: Result<(), _> = redis::cmd("SET").arg(&k).arg(1).arg("PX").arg(for_.as_millis() as u64).query_async(&mut conn).await;
            if r.is_ok() {
                return;
            }
        }
        let until = self.started.elapsed() + for_;
        self.local.lock().unwrap_or_else(|p| p.into_inner()).insert(k, (until.as_millis() as u64, 0, 0));
    }

    /// Seconds remaining on a ban, if any.
    pub async fn blocked_for(&self, scope: &str, key: &str) -> Option<u64> {
        let k = format!("{}:block:{}:{}", self.prefix, scope, key);
        if let Some(conn) = &self.redis {
            let mut conn = conn.clone();
            let r: Result<i64, _> = redis::cmd("PTTL").arg(&k).query_async(&mut conn).await;
            if let Ok(ms) = r {
                if ms > 0 {
                    return Some((ms as u64 + 999) / 1000);
                }
                if self.local.lock().unwrap_or_else(|p| p.into_inner()).get(&k).is_none() {
                    return None;
                }
            }
        }
        let now = self.started.elapsed().as_millis() as u64;
        let map = self.local.lock().unwrap_or_else(|p| p.into_inner());
        map.get(&k).and_then(|(until, _, _)| until.checked_sub(now)).filter(|ms| *ms > 0).map(|ms| (ms + 999) / 1000)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn local_limiter_blocks_after_the_quota_and_scopes_are_independent() {
        let rl = RateLimiter::connect(None, "t").await.unwrap();
        let w = Duration::from_secs(60);
        for _ in 0..3 {
            assert!(rl.hit("a", "k", 3, w).await.allowed);
        }
        assert!(!rl.hit("a", "k", 3, w).await.allowed);
        assert!(rl.hit("a", "other", 3, w).await.allowed);
        assert!(rl.hit("b", "k", 3, w).await.allowed);
    }

    /// Two limiters on one Redis behave as one (needs REDIS_URL).
    #[tokio::test]
    async fn instances_share_one_count_through_redis() {
        let Ok(url) = std::env::var("REDIS_URL") else { return };
        let prefix = format!("test{}", std::process::id());
        let a = RateLimiter::connect(Some(&url), &prefix).await.unwrap();
        let b = RateLimiter::connect(Some(&url), &prefix).await.unwrap();
        let w = Duration::from_secs(60);
        assert!(a.is_shared());
        assert!(a.hit("s", "k", 3, w).await.allowed);
        assert!(b.hit("s", "k", 3, w).await.allowed);
        assert!(a.hit("s", "k", 3, w).await.allowed);
        assert!(!b.hit("s", "k", 3, w).await.allowed, "the fourth hit across both instances must be refused");
        a.block("ip", "9.9.9.9", Duration::from_secs(20)).await;
        assert!(b.blocked_for("ip", "9.9.9.9").await.is_some());
    }

    #[tokio::test]
    async fn block_then_blocked_for() {
        let rl = RateLimiter::connect(None, "t").await.unwrap();
        assert!(rl.blocked_for("ip", "1.2.3.4").await.is_none());
        rl.block("ip", "1.2.3.4", Duration::from_secs(30)).await;
        assert!(rl.blocked_for("ip", "1.2.3.4").await.is_some());
    }
}
