# nID Rust API

Rust backend replacing the TypeScript NestJS API in `apps/api`.

## Architecture

This is Phase 1 of the backend migration from TypeScript/Node.js to Rust.
The Rust API shares the same PostgreSQL database with the same schema
(managed by Prisma in `packages/db`), so both backends can coexist during
the migration period.

### Framework Choices

| Component | Choice | Replaces |
|-----------|--------|----------|
| Web framework | Axum 0.8 | NestJS |
| Database | SQLx + deadpool-postgres | Prisma |
| Async runtime | Tokio | Node.js event loop |
| Workflows | Temporal Rust SDK (planned) | Temporal TypeScript SDK |
| Logging | tracing | NestJS Logger |

### Project Structure

```
apps/rust-api/
├── Cargo.toml
└── src/
    ├── main.rs              # Entry point, server bootstrap
    ├── core/
    │   ├── config/          # Environment config (mirrors env.ts)
    │   ├── db/              # Connection pool + tenant context
    │   └── auth/            # Session & API key guards
    └── modules/
        └── accounts/        # First migrated module (OTP, sessions)
```

### Shared Crates

```
crates/
├── shared-types/   # Crypto, tokens, API keys (mirrors packages/shared-types)
├── storage/        # File storage abstraction (mirrors packages/storage)
└── billing/        # Money, ledger, billing types (mirrors packages/billing)
```

## Development

### Prerequisites

- Rust 1.70+ (use `rustup` to install)
- PostgreSQL 16 (via docker-compose)
- Temporal 1.24 (via docker-compose, for workflows)

### Running

```bash
# Start infrastructure
docker-compose up -d

# Set environment variables (copy from .env.example)
cp .env.example .env

# Run the API
cargo run --package nid-api

# Run with tests
cargo test --workspace

# Lint
cargo clippy --workspace -- -D warnings

# Format
cargo fmt --workspace
```

### Migration Strategy

1. **Phase 1 (now):** Rust project structure + core infrastructure + Accounts module
2. **Phase 2:** Migrate tenant-facing modules (Subjects, VerificationCases, Sessions)
3. **Phase 3:** Migrate profile and booking modules
4. **Phase 4:** Migrate shared packages (billing, forensics, OCR, liveness)
5. **Phase 5:** Migrate Temporal workflows to Rust SDK
6. **Phase 6:** Remove TypeScript backend, Rust-only

During migration, both backends share the same database. The TypeScript API
remains the primary entry point until all modules are migrated.
