//! SQLx-native schema migrations for nID's Postgres database.
//!
//! Replaces `packages/db/prisma/migrations` (Prisma) as the source of
//! truth for schema changes going forward — see CONVENTIONS.md's
//! "Decided, migration tracked" section. The first migration here is a
//! `pg_dump --schema-only` snapshot of the schema as Prisma's migrations
//! had already built it, so this is a cutover point, not a rewrite: no
//! table, column, or RLS policy changed, only the tool that owns them.
//!
//! `apps/workflows`, `packages/verification-providers`, and
//! `packages/billing` still read/write this same database through the
//! Prisma client directly (not through `apps/rust-api`), so
//! `packages/db/prisma` stays in the repo — and schema changes must be
//! applied to both migration sets in lockstep — until those three
//! services are themselves ported off Prisma. That port is a separate,
//! much larger piece of work, tracked but not started.

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");
