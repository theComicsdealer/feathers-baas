# PRD: `feathers-baas` — A Database-Agnostic, Production-Ready API Generator CLI

> **Working name:** `feathers-baas` (rename TBD — candidates: `featherbase`, `feathercore`, `plume`, `quill`)
> **Owner:** Florent Ogoutchoro
> **Status:** Draft v0.1 — for Claude Code implementation
> **Audience:** Claude Code (implementation agent) + future contributors

---

## 1. Vision

Build a CLI tool that scaffolds and runs a **production-grade Feathers.js v5 backend** with the batteries-included experience of Supabase or Firebase, but:

- **Self-hosted by default** (no vendor lock-in).
- **Database-agnostic** (Postgres, MySQL, SQLite, MongoDB — leveraging Feathers' adapter ecosystem).
- **CLI-first and agent-friendly** — every operation scriptable, every config declarative, optimized for use inside Claude Code, Cursor, and similar agentic environments.
- **Extensible** via a plugin contract, not a monolith.

The core thesis: Feathers.js is the most under-appreciated Node backend framework for the agentic-coding era because its **service-oriented model maps 1:1 to how LLMs reason about CRUD APIs**. We expose that as a turnkey product.

---

## 2. Goals & Non-Goals

### Goals
1. `npx feathers-baas init my-api` produces a runnable, production-ready Feathers.js v5 backend in under 60 seconds.
2. First-class built-in services for **auth, users, roles & permissions, notifications, file uploads**.
3. **Database-agnostic** — user picks adapter at init; all built-in services work across Postgres, MySQL, SQLite, MongoDB.
4. **Storage-agnostic** for files — local disk, AWS S3, Google Cloud Storage, with a pluggable driver interface.
5. **Notification-channel-agnostic** — email (SMTP, SendGrid, Resend), SMS (Twilio), push (FCM, APNs), webhooks.
6. Generators for new resources: `feathers-baas generate service posts` produces service + schema + migration + tests.
7. Production defaults out of the box: structured logging (pino), env-based config, Docker, health checks, OpenAPI spec, graceful shutdown.

### Non-Goals (v1)
- A hosted control plane or web dashboard (CLI + generated admin endpoints only in v1).
- A frontend SDK (Feathers' existing client libraries cover this).
- Replacing Feathers itself — this is a meta-framework on top, not a fork.
- Realtime collaboration primitives beyond what Feathers' built-in channels already give us.

---

## 3. Target User

Two primary personas:

1. **The agentic builder** (Florent's archetype): a technical founder or solo PM building MVPs with Claude Code / Cursor. Needs a backend that an LLM can extend without ceremony.
2. **The startup CTO**: needs a production backend in a day, not a quarter, but refuses to be locked into Firebase pricing or Supabase's Postgres-only stance.

Secondary: backend devs who already love Feathers and want a sane scaffold.

---

## 4. Competitive Positioning

| | Supabase | Firebase | Pocketbase | **feathers-baas** |
|---|---|---|---|---|
| Self-hosted | ✓ (heavy) | ✗ | ✓ | ✓ (light) |
| DB-agnostic | ✗ (PG only) | ✗ | ✗ (SQLite) | ✓ |
| CLI-first | partial | partial | ✗ | ✓ |
| Agent-friendly schema | ✗ | ✗ | partial | ✓ (typed services) |
| Pluggable storage | ✗ | ✗ | partial | ✓ |
| Realtime | ✓ | ✓ | ✓ | ✓ (Feathers channels) |

The wedge: **agent-friendliness + true DB/storage agnosticism**.

---

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    feathers-baas CLI                    │
│   (commander/clipanion · prompts · zx-style execution)  │
└──────────────┬──────────────────────────────────────────┘
               │ scaffolds & manages
               ▼
┌─────────────────────────────────────────────────────────┐
│              Generated Feathers.js v5 App               │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Built-in   │  │   Built-in   │  │   Built-in   │   │
│  │   Services   │  │  Middleware  │  │   Channels   │   │
│  │              │  │              │  │              │   │
│  │ • auth       │  │ • rate-limit │  │ • realtime   │   │
│  │ • users      │  │ • validation │  │ • per-role   │   │
│  │ • roles      │  │ • audit-log  │  │              │   │
│  │ • files      │  │ • cors/helmet│  │              │   │
│  │ • notifs     │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│         │                  │                  │         │
│         ▼                  ▼                  ▼         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  DB Adapter  │  │ Storage Drv  │  │  Notif Drv   │   │
│  │  (Knex/Mongo)│  │ (S3/GCS/FS)  │  │ (SMTP/SMS..) │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                         │
│  BullMQ (jobs) · pino (logs) · OpenAPI · Docker         │
└─────────────────────────────────────────────────────────┘
```

The CLI is a **scaffolder + runtime helper**. Generated apps are standalone — they don't need the CLI to run, only to extend.

---

## 6. CLI Surface (v1)

```bash
# Project lifecycle
feathers-baas init <name>           # interactive scaffold
feathers-baas init <name> --preset=postgres-s3-resend --yes
feathers-baas dev                   # run with hot reload
feathers-baas start                 # production start
feathers-baas doctor                # diagnose env, db, storage, notif config

# Generators
feathers-baas generate service <name> [--schema=./schema.json]
feathers-baas generate hook <name>
feathers-baas generate channel <name>
feathers-baas generate migration <name>

# Database
feathers-baas db migrate
feathers-baas db rollback
feathers-baas db seed
feathers-baas db reset --confirm

# Auth
feathers-baas auth create-user --email=... --role=admin
feathers-baas auth issue-token --user-id=...
feathers-baas auth list-roles

# Plugins
feathers-baas plugin add <name>
feathers-baas plugin list
```

All commands must support `--json` output for agent consumption.

---

## 7. Built-in Services (v1)

### 7.1 Auth Service (`/authentication`)
- **Strategies:** local (email/password with argon2id), JWT, optional OAuth2 (Google, GitHub) via `@feathersjs/authentication-oauth`.
- **Token rotation:** short-lived access (15min) + refresh tokens stored hashed in DB.
- **Password reset & email verification flows** (delegated to Notifications service).
- **MFA (TOTP)** — scaffolded but disabled by default.
- Rate limiting on login endpoints.

### 7.2 Users Service (`/users`)
- Standard CRUD with `id`, `email`, `passwordHash`, `roleIds[]`, `metadata`, timestamps, `lastLoginAt`, `isActive`, `emailVerifiedAt`.
- Soft delete by default.
- Hooks: hash password before save, strip password on output, prevent privilege escalation in `patch`.

### 7.3 Roles & Permissions Service (`/roles`, `/permissions`)
- **RBAC** with permissions as `resource:action` strings (e.g. `posts:create`, `users:*`).
- Pre-seeded roles: `admin`, `user`, `guest`.
- A `can(user, action, resource)` helper exposed to all hooks.
- Per-service permission decorators applied via a generated `permissions.config.ts`.

### 7.4 Files Service (`/files`)
- Multipart upload via `@feathersjs/koa` or express adapter.
- **Driver interface:** `put`, `get`, `delete`, `signUrl`, `list`.
- Built-in drivers:
  - `local` (dev default)
  - `s3` (AWS SDK v3)
  - `gcs` (Google Cloud Storage)
- Metadata stored in DB (`files` table): `id`, `key`, `size`, `mimeType`, `ownerId`, `driver`, `bucket`, `createdAt`, `signedUrlExpiresAt`.
- Optional image transforms (sharp) behind a flag.
- Virus scan hook stub (ClamAV plugin in v1.1).

### 7.5 Notifications Service (`/notifications`)
- **Channel drivers:** `email` (SMTP, SendGrid, Resend), `sms` (Twilio), `push` (FCM, APNs), `webhook`.
- **Template engine:** MJML for email, plain templates for SMS/push, stored in `templates/` folder, hot-reloadable in dev.
- **Queueing:** BullMQ-backed; failures retry with exponential backoff.
- Notification preferences per user (`notification_preferences` table).
- Audit log of every send attempt.

---

## 8. Database Layer

- Use **Feathers' Knex adapter** for SQL (Postgres, MySQL, SQLite) and **MongoDB adapter** for Mongo.
- Schemas defined with **TypeBox** (Feathers v5 native) — single source of truth for validation, types, and OpenAPI.
- Migrations via Knex for SQL; for Mongo, an internal lightweight migration runner using a `_migrations` collection.
- The CLI generates idiomatic migrations for whichever adapter the project picked at init.

**Adapter selection at init:**
```
? Database: (Use arrow keys)
❯ PostgreSQL (recommended)
  MySQL / MariaDB
  SQLite (dev / single-node)
  MongoDB
```

---

## 9. Configuration

- **`.env`** for secrets (12-factor).
- **`config/default.json`** + `config/{env}.json` (Feathers' built-in convict-style config).
- **`feathers-baas.config.ts`** at project root for CLI-aware settings: enabled built-ins, plugin list, generator preferences.

Example:
```ts
// feathers-baas.config.ts
export default {
  builtins: {
    auth: { strategies: ['local', 'jwt', 'google'] },
    files: { driver: 's3', bucket: process.env.S3_BUCKET },
    notifications: {
      email: { driver: 'resend' },
      sms: { driver: 'twilio' }
    }
  },
  plugins: ['@feathers-baas/plugin-stripe']
}
```

---

## 10. Plugin System

A plugin is an npm package exporting:
```ts
export default {
  name: string,
  services?: ServiceDefinition[],
  hooks?: HookDefinition[],
  migrations?: string,           // path to migration files
  cli?: CommandDefinition[]      // extends `feathers-baas` CLI
}
```

The CLI registers plugins by mutating `feathers-baas.config.ts` and running their migrations.

---

## 11. Production Defaults

Generated apps ship with:
- **Logging:** pino with redaction of sensitive fields.
- **Health check:** `GET /health` (liveness) and `/health/ready` (readiness — checks DB, storage, queue).
- **OpenAPI 3.1 spec** auto-generated from TypeBox schemas, served at `/openapi.json` and Swagger UI at `/docs`.
- **Docker:** multi-stage `Dockerfile` + `docker-compose.yml` (app + db + redis for BullMQ).
- **Graceful shutdown:** SIGTERM handler drains connections and BullMQ workers.
- **Security:** helmet, CORS, rate limiting (Redis-backed in prod, memory in dev), CSRF for cookie-auth flows.
- **Tests:** Vitest setup with example service test.
- **CI:** GitHub Actions workflow for lint, test, build, Docker publish.

---

## 12. Agent-Friendliness Requirements

This is the differentiator. Every design choice must pass: **"can Claude Code extend this in one shot without reading framework internals?"**

- **Single-file service definitions** (schema + class + hooks colocated in `services/<name>/<name>.ts`).
- **Generated code includes inline comments** explaining the contract, not how Feathers works.
- **`feathers-baas doctor --json`** outputs machine-readable diagnostics.
- **`feathers-baas describe`** dumps the full app surface (services, hooks, channels, permissions) as JSON — for agents to introspect before editing.
- **`AGENTS.md`** is generated at the project root with the conventions Claude Code should follow when extending the project.

---

## 13. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Feathers.js v5 | Service-oriented, transport-agnostic, mature |
| Language | TypeScript (strict) | Required for agent ergonomics |
| HTTP | Koa (Feathers v5 default) | Lighter than Express, async-native |
| ORM/Query | Knex (SQL) + native Mongo driver | Matches Feathers adapters |
| Validation | TypeBox | Feathers v5 native |
| Auth | `@feathersjs/authentication` + argon2 | Standard |
| Queue | BullMQ + Redis | Used in Palbot already; battle-tested |
| Logging | pino | Fast, structured |
| Testing | Vitest | ESM-native, fast |
| CLI | clipanion or commander + prompts | Type-safe commands |
| Build | tsup | Zero-config TS bundling |

---

## 14. Milestones

**M1 — Skeleton (week 1–2)**
CLI `init` produces a runnable Feathers v5 app with Postgres, auth, users, roles. No files, no notifications yet.

**M2 — Storage & Notifications (week 3–4)**
Files service with local + S3 + GCS drivers. Notifications service with email (SMTP + Resend) + BullMQ.

**M3 — Generators & DB Agnosticism (week 5)**
`generate service`, `generate hook`. Add MySQL, SQLite, MongoDB adapters with parity tests.

**M4 — Production polish (week 6)**
OpenAPI, Docker, health checks, graceful shutdown, doctor, describe, AGENTS.md.

**M5 — Plugin system + 1.0 release (week 7–8)**
Plugin loader, one reference plugin (e.g. Stripe billing), docs site, npm publish.

---

## 15. Open Questions

1. **Monorepo or single package?** Lean monorepo (pnpm workspaces): `core`, `cli`, `plugin-*`. Easier to ship plugins independently.
2. **Koa vs Express transport?** Default Koa (Feathers v5 recommendation), allow opt-out flag.
3. **Do we ship an admin UI?** Out of scope for v1 — but reserve `/admin` namespace and document the contract for community admin UIs.
4. **License?** Suggest MIT for adoption; revisit if commercial offering emerges (BSL/Elastic 2.0 like Sentry/Cal.com).
5. **Naming.** Final name needs trademark + npm availability check before M5.

---

## 16. Success Metrics (post-launch)

- Time from `npx feathers-baas init` to first authenticated API call: **< 5 minutes**.
- A Claude Code agent can add a new resource (service + auth + tests) in **one prompt** with > 90% success rate on a held-out eval set.
- 1,000 GitHub stars within 6 months.
- 10 community plugins within 12 months.

---

## 17. Notes for Claude Code (implementation agent)

- Read this PRD top to bottom before generating any code.
- Start with M1; do **not** scaffold features outside the milestone you're working on.
- Mirror Feathers v5's official generator output where possible — do not re-invent its file layout unless this PRD explicitly says so.
- All generated files must include a top-of-file comment: `// Generated by feathers-baas. Safe to edit.` (or `// DO NOT EDIT.` for files we regenerate).
- Write tests alongside features, not after.
- When in doubt, optimize for the agentic-builder persona: clarity over cleverness, convention over configuration, JSON-introspectable everywhere.
