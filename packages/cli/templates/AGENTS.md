# AGENTS.md — Codebase Guide for AI Agents

This file helps AI coding assistants (Claude Code, Copilot, Cursor, etc.) understand the project structure, conventions, and the tasks they can perform using the CLI.

---

## Project overview

This is a **feathers-baas** project — a Feathers.js v5 backend with TypeBox schemas, Knex (SQL) or MongoDB, and role-based access control.

---

## Codebase structure

```
src/
├── index.ts                # App entry point — creates app, starts server, graceful shutdown
├── services/
│   └── index.ts            # Extension point — add custom service configure calls here
├── hooks/                  # Custom project-level hooks
migrations/                 # Knex migration files (SQL only; empty for MongoDB)
.env                        # Environment variables (gitignored)
.env.example                # Template with all available env vars
```

The core framework lives in `@feathers-baas/core`. Your project extends it via `createApp({ configureServices })`.

### Core internals (inside @feathers-baas/core)

```
app.ts                      # App factory — bootstrap order matters (see below)
configuration.ts            # TypeBox config schema, reads env vars
declarations.ts             # Feathers Application type augmentation
logger.ts                   # Pino logger setup
health.ts                   # GET /health, GET /health/ready
openapi.ts                  # OpenAPI 3.1 spec + Scalar UI (GET /openapi.json, GET /docs)
channels.ts                 # Real-time channel setup
seed.ts                     # Database seeding (default roles + admin user)
db/
├── knex.ts                 # PostgreSQL adapter (Knex)
├── mysql.ts                # MySQL adapter (Knex)
├── sqlite.ts               # SQLite adapter (Knex)
└── mongo.ts                # MongoDB adapter (native driver)
auth/
├── index.ts                # JWT + local auth strategies (argon2id), refresh cookie
├── refresh.ts              # POST /authentication/refresh endpoint (API clients)
├── auth-management.ts      # Email verification, password reset
├── strategies/jwt.strategy.ts  # BaasJWTStrategy — transparent token refresh via cookie
└── notifier.ts             # Auth event → notification pipeline
services/
├── users/                  # Users service (schema, class, hooks, service)
└── roles/                  # Roles service (schema, class, hooks, service)
hooks/
├── permission-check.ts     # RBAC hook (LRU-cached, 5-min TTL)
├── timestamps.ts           # Sets createdAt / updatedAt on create and patch
└── log-error.ts            # Global error logging
```

---

## Service anatomy

Each service is four colocated files:

| File | Purpose |
|---|---|
| `<name>.schema.ts` | TypeBox schemas: main (DB row), data (create input), patch, query |
| `<name>.class.ts` | `KnexService` or `MongoDBService` subclass |
| `<name>.hooks.ts` | Before/after/error hook chains |
| `<name>.service.ts` | Wires class + hooks, mounts on app, registers OpenAPI schemas |

---

## Bootstrap order

`createApp()` bootstraps in strict order — each step depends on the previous:

| Step | What happens |
|---|---|
| 1 | `resolveConfig()` — TypeBox env validation, fail-fast |
| 2 | cors + errorHandler + bodyParser (multipart disabled — busboy handles it) |
| 3 | `configureHealth()` — `/health`, `/health/ready` (no auth required) |
| 4 | `configureOpenApi()` — `/openapi.json`, `/docs` (no auth required) |
| 5 | req injection middleware — copies `ctx.req` → `ctx.feathers` so hooks see `params.req` |
| 6 | `rest()` — Feathers REST transport (must come after step 5) |
| 7 | `configureKnex/Mysql/Sqlite/Mongo()` — DB connection |
| 8 | `configureAuth()` — JWT + local strategies |
| 9 | `configureRefresh()` — `POST /authentication/refresh` |
| 10 | `configureServices()` — users, roles, and your custom services |
| 11 | `configureAuthManagement()` — verify email, reset password (needs users service) |
| 12 | `configureChannels()` — real-time |
| 13 | `configureNotifications()` — BullMQ + email drivers |
| 14 | `installPlugins()` — auto-discovered from package.json |
| 15 | global `logError` around hook |

---

## Database support

| Database | Env var | Service class | ID field |
|---|---|---|---|
| PostgreSQL | `DATABASE_URL` | `KnexService` | `id` (UUID) |
| MySQL | `MYSQL_URL` | `KnexService` | `id` (UUID) |
| SQLite | `SQLITE_FILENAME` | `KnexService` | `id` (UUID) |
| MongoDB | `MONGODB_URL` | `MongoDBService` | `_id` (ObjectId) |

Knex adapters auto-convert camelCase (TypeScript) ↔ snake_case (DB columns). MongoDB uses camelCase natively.

---

## Field types (for `generate service`)

| Type | TypeBox | Knex column |
|---|---|---|
| `string` | `Type.String()` | `string(255)` |
| `text` | `Type.String()` | `text` |
| `integer` | `Type.Integer()` | `integer` |
| `number` | `Type.Number()` | `float` |
| `boolean` | `Type.Boolean()` | `boolean` |
| `date` | `Type.String({ format: 'date-time' })` | `timestamp` |
| `json` | `Type.Object({})` | `jsonb` |
| `ref:<service>` | `Type.String({ format: 'uuid' })` | `uuid` FK → `<service>(id)` |

Append `:optional` to any field to make it nullable. Use `ref:<service>` for foreign keys; add `--populate` to auto-generate a batched `populateRefs` after-hook.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | * | Postgres connection string |
| `MYSQL_URL` | * | MySQL connection string |
| `SQLITE_FILENAME` | * | SQLite file path |
| `MONGODB_URL` | * | MongoDB connection string |
| `JWT_SECRET` | Yes | HMAC secret (min 32 chars) |
| `PORT` | | HTTP port (default: 3030) |
| `NODE_ENV` | | development / test / production |
| `JWT_EXPIRY` | | Access token lifetime (default: 15m) |
| `JWT_REFRESH_EXPIRY` | | Refresh token lifetime (default: 7d) |
| `ADMIN_EMAIL` | | Admin email (used by `seed` and `auth create-admin`) |
| `ADMIN_PASSWORD` | | Admin password (used by `seed`) |
| `REDIS_URL` | | Enables BullMQ queue for notifications |
| `CORS_ORIGINS` | | Comma-separated allowed origins |
| `APP_URL` | | Public base URL used in email links |

\* Exactly one database variable is required.

---

## Project commands

```bash
pnpm dev           # Start dev server with hot reload
pnpm build         # Build with tsup
pnpm typecheck     # Run tsc --noEmit
pnpm test          # Run vitest
```

---

## CLI commands

All `feathers-baas` commands that run against the database (`migrate`, `seed`, `auth *`) boot the app via `createApp()` and load `.env` automatically.

```bash
# Migrations (SQL only)
npx feathers-baas migrate                    # Run pending migrations
npx feathers-baas rollback                   # Roll back last migration batch

# Seeding
npx feathers-baas seed                       # Seed default roles + admin user from .env

# Code generation
npx feathers-baas generate service           # Generate a service (interactive or with flags)
npx feathers-baas generate hook              # Generate a hook

# Role & user management
npx feathers-baas auth list-roles            # List all roles and permissions
npx feathers-baas auth list-roles --json     # Machine-readable JSON
npx feathers-baas auth create-role           # Create a role (interactive)
npx feathers-baas auth add-permissions       # Add a permission to a role
npx feathers-baas auth remove-permissions    # Remove permissions from a role
npx feathers-baas auth create-admin          # Create an admin user

# Diagnostics
npx feathers-baas doctor                     # Check project health (env, DB, versions)
npx feathers-baas doctor --json              # Machine-readable health report
npx feathers-baas describe                   # Introspect services, methods, hooks (JSON)
```

---

## Agent skills

The following skills describe tasks you (the AI agent) can perform using the CLI. Each skill lists the exact command(s) to run.

---

### skill: generate-service

**When to use:** the user asks you to add a new resource, entity, table, or collection.

**Inputs to gather first:**
- Service name (lowercase, plural, e.g. `posts`)
- Fields: comma-separated `name:type[:optional]` pairs — types are `string`, `text`, `integer`, `number`, `boolean`, `date`, `json`, `ref:<service>`
- Whether to add `--populate` for FK fields with `ref` type

**Steps:**
```bash
# 1. Generate files and patch services/index.ts + declarations.ts
npx feathers-baas generate service --name <name> --fields "<fields>" [--populate]

# 2. Run migration (SQL databases only — skip for MongoDB)
npx feathers-baas migrate
```

**What it creates:** schema, class, hooks, service, migration, patches to `services/index.ts` and `declarations.ts`.

**After running:** tell the user the service is live at `/<name>` and show the generated file list.

---

### skill: generate-hook

**When to use:** the user asks you to add a custom hook (e.g. slugify a field, send a webhook, validate business logic).

**Steps:**
```bash
npx feathers-baas generate hook --name <hook-name>
```

Then add the hook to the relevant service's `hooks.ts` file.

---

### skill: create-role

**When to use:** the user asks you to add a new role (e.g. `editor`, `moderator`).

**Inputs to gather:**
- Role name
- Permissions: list of `{ service, methods[] }` pairs — use `*` for all services or all methods

**Non-interactive (preferred for scripting):**
```bash
# Add permissions one at a time after creating
npx feathers-baas auth create-role --name <name>
npx feathers-baas auth add-permissions --role <name> --service <service> --methods find,get,create,patch
```

**Interactive (when exploring with the user):**
```bash
npx feathers-baas auth create-role
```

**After running:** confirm the role was created by running `auth list-roles`.

---

### skill: add-permissions

**When to use:** the user asks you to grant a role access to a service or method.

```bash
npx feathers-baas auth add-permissions --role <name> --service <service> --methods <m1,m2,...>
```

Use `*` for all methods: `--methods '*'`

---

### skill: remove-permissions

**When to use:** the user asks you to revoke a role's access to a service.

```bash
# Interactive — shows a checkbox list of current permissions
npx feathers-baas auth remove-permissions --role <name>
```

---

### skill: create-admin

**When to use:** the user asks you to create an admin account (e.g. for a new environment or team member).

```bash
npx feathers-baas auth create-admin --email <email> --password <password>
```

The account is created with `roles: ['admin']` and is auto-verified. The password is hashed by the users service hooks.

---

### skill: inspect-project

**When to use:** you need to understand what services exist before editing code (e.g. before adding a hook, before generating a related service).

```bash
npx feathers-baas describe
```

Parse the JSON output to get the current service list, methods, hooks, and migrations. Use this before generating code that references other services.

---

### skill: health-check

**When to use:** the user reports something is wrong, or you want to verify the environment before running migrations or seed.

```bash
npx feathers-baas doctor --json
```

Check that all items in `checks` have `status: "ok"`. If `database` fails, there is a connection or env var issue — do not run `migrate` or `seed` until it passes.

---

### skill: run-migrations

**When to use:** after generating a new service (SQL databases), or when the user reports schema errors.

```bash
npx feathers-baas migrate
```

No-op for MongoDB. Idempotent — safe to run multiple times.

---

### skill: seed-database

**When to use:** on a fresh database (no roles or admin user exist yet), or when the user asks to reset default data.

```bash
npx feathers-baas seed
```

Idempotent. Creates `admin` and `user` roles, and an admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.

---

## Conventions

- **camelCase** in TypeScript, **snake_case** in DB columns (auto-converted by Knex; MongoDB is camelCase natively)
- TypeBox schemas are the source of truth for validation and OpenAPI docs
- Passwords hashed with argon2id, stripped from all API responses
- Role permissions stored as JSONB (SQL) or embedded array (MongoDB), LRU-cached per request cycle
- All hook chains gate on `isProvider('rest')` — internal CLI calls bypass auth/RBAC
- `createdAt`, `updatedAt`, `deletedAt` are managed by hooks — do not set them manually
- The auth entity ID is `id` for SQL and `_id` for MongoDB

---

## API surface

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/users` | none | Register |
| `GET` | `/users` | admin | List users |
| `GET` | `/users/:id` | jwt | Get user |
| `PATCH` | `/users/:id` | jwt (own) | Update user |
| `DELETE` | `/users/:id` | jwt (own / admin) | Delete user |
| `POST` | `/authentication` | none | Login — returns `accessToken` + `refreshToken` |
| `DELETE` | `/authentication` | jwt | Logout — clears refresh cookie |
| `POST` | `/authentication/refresh` | none | Exchange refresh token for new access token |
| `POST` | `/authManagement` | none | Verify email, reset password, change password/email |
| `GET` | `/roles` | admin | List roles |
| `POST` | `/roles` | admin | Create role |
| `PATCH` | `/roles/:id` | admin | Update role |
| `DELETE` | `/roles/:id` | admin | Delete role |
| `GET` | `/health` | none | Liveness probe |
| `GET` | `/health/ready` | none | Readiness probe |
| `GET` | `/openapi.json` | none | OpenAPI 3.1 spec |
| `GET` | `/docs` | none | Swagger UI (Scalar) |

File storage endpoints (if `@feathers-baas/plugin-files` is configured):

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/files` | jwt | Upload file (`multipart/form-data`) |
| `GET` | `/files` | jwt | List file records |
| `GET` | `/files/:id` | jwt | Get file record |
| `PATCH` | `/files/:id` | jwt | Update metadata |
| `DELETE` | `/files/:id` | jwt | Delete record + binary |

---

## Plugin system

Plugins are npm packages auto-discovered from `package.json` dependencies. A package is a plugin if its `package.json` has `"feathers-baas-plugin": true` or `keywords` includes `"feathers-baas-plugin"`.

Built-in plugins:
- `@feathers-baas/plugin-files` — file storage (local / S3 / GCS)
- `@feathers-baas/plugin-notifications` — email delivery (SMTP / Resend / SendGrid / Brevo)
