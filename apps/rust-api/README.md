# nID Rust API

Rust backend replacing the TypeScript NestJS API in `apps/api`.

## Architecture

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
| Logging | tracing + request tracing middleware | NestJS Logger |
| Error handling | Structured ApiError enum | NestJS exception filters |
| Audit logging | AuditService | NestJS audit.service.ts |

### Project Structure

```
apps/rust-api/
├── Cargo.toml
└── src/
    ├── main.rs              # Entry point, router wiring, graceful shutdown
    ├── core/
    │   ├── config/          # Environment config (mirrors env.ts)
    │   ├── db/              # Connection pool + tenant context (RLS)
    │   ├── auth/            # Session & API key extractors
    │   ├── middleware/      # Request tracing, timing, X-Request-Id
    │   ├── error/           # Structured ApiError with HTTP status mapping
    │   ├── audit/           # Audit log recording service
    │   └── upload/          # Multipart file upload utilities
    └── modules/
        ├── accounts/        # OTP, sessions, email verification
        ├── tenants/         # Tenant CRUD, API keys, staff management
        ├── subjects/        # Subject creation, badges, attribute badges
        ├── verification_cases/  # Case creation, OTP/code/location submission
        ├── organizations/   # Org CRUD, memberships, beneficial owners
        ├── sessions/        # Verification session status, method submission
        ├── brands/          # Brand CRUD, membership listing
        ├── profiles/        # Profile CRUD, grants, badges, public lookup
        ├── badges/          # Badge ranking, cross-tenant lookups (library)
        ├── organization_profiles/  # Org-owned profile management
        ├── access/          # Grant CRUD, ownership transfer, partnerships
        ├── roles/           # Role definitions, assignments
        ├── permissions/     # Permission catalog, group queries
        ├── departments/     # Department CRUD, assignments
        ├── invitations/     # Email/username invites, accept/revoke
        ├── tenant_staff/    # Staff invite and listing
        ├── account_verification/  # Verification status, self-verification
        ├── oauth/           # Login requests, approve, claim, token exchange
        ├── booking/         # Services, availability, appointments
        ├── profile_content/ # Offers, business hours, links, images
        └── health/          # Health check endpoint
```

### Shared Crates

```
crates/
├── shared-types/   # Crypto, tokens, API keys (mirrors packages/shared-types)
├── storage/        # File storage abstraction (mirrors packages/storage)
└── billing/        # Money, ledger, billing types (mirrors packages/billing)
```

## Migration Status

All 16 NestJS API modules have been migrated to Rust with **155+ endpoints** covering:

- **Core infrastructure**: Config, DB pool with RLS, auth extractors, middleware, error handling, audit logging
- **All API modules**: Accounts, Tenants, Subjects, Verification Cases, Organizations, Sessions, Brands, Profiles, Badges, Organization Profiles, Access Control, Roles, Permissions, Departments, Invitations, Tenant Staff, Account Verification, OAuth, Booking, Profile Content, Health

### Remaining Work

- **File storage integration**: Uploaded file bytes are recorded in the database but not yet persisted via the storage driver (S3/local) — the multipart parsing layer is complete
- **Temporal workflow integration**: Verification case workflows need Temporal Rust SDK
- **Compilation**: Requires MSVC Build Tools on Windows (admin install needed)
- **Testing**: Integration tests for all endpoints
- **Performance**: Benchmarking against TypeScript baseline

## Development

### Prerequisites

- Rust 1.70+ (use `rustup` to install)
- MSVC Build Tools (Windows) — "Desktop development with C++" workload
- PostgreSQL 16 (via docker-compose or local install)
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
