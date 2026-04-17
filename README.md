# feathers-baas

A CLI tool that scaffolds and runs a **production-grade Feathers.js v5 backend** with the batteries-included experience of Supabase or Firebase — self-hosted, database-agnostic, and optimized for agentic coding environments.

```bash
npx feathers-baas init my-api
```

---

## Why

[Feathers.js](https://feathersjs.com) is the most under-appreciated Node backend framework for the agentic-coding era. Its service-oriented model maps 1:1 to how LLMs reason about CRUD APIs. `feathers-baas` exposes that as a turnkey product.

|                    | Supabase        | Firebase | Pocketbase   | **feathers-baas** |
|--------------------|-----------------|----------|--------------|-------------------|
| Self-hosted        | ✓ (heavy)       | ✗        | ✓            | ✓ (light)         |
| DB-agnostic        | ✗ (Postgres only) | ✗      | ✗ (SQLite)   | ✓                 |
| CLI-first          | partial         | partial  | ✗            | ✓                 |
| Agent-friendly     | ✗               | ✗        | partial      | ✓ (typed services)|
| Pluggable storage  | ✗               | ✗        | partial      | ✓                 |
| Realtime           | ✓               | ✓        | ✓            | ✓ (Feathers channels) |

---

## Status

> **M4 complete** — production polish: OpenAPI docs, health checks, Docker, CLI doctor/describe.

| Milestone | Status | What ships |
|---|---|---|
| M1 — Skeleton | ✅ Done | Auth, users, roles, Postgres, migrations |
| M2 — Storage & Notifications | ✅ Done | `plugin-files` (local/S3/GCS) · `plugin-notifications` (SMTP/Resend/SendGrid/Brevo) · auth management (verify email, password reset) |
| M3 — Generators & DB agnosticism | ✅ Done | `generate service` · `generate hook` · MySQL/SQLite/MongoDB adapters |
| M4 — Production polish | ✅ Done | OpenAPI `/docs` · health checks · Docker · `doctor` · `describe` · `AGENTS.md` |
| M5 — Plugin system | 📋 Planned | Plugin loader, npm publish |

---

## Monorepo structure

```
feathers-baas/
├── packages/
│   ├── core/                    # @feathers-baas/core — the Feathers app factory
│   ├── plugin-files/            # @feathers-baas/plugin-files — file storage (local/S3/GCS)
│   ├── plugin-notifications/    # @feathers-baas/plugin-notifications — BullMQ email queue
│   └── cli/                     # feathers-baas — the npx-able CLI (generate service, generate hook)
├── PLAN.md              # Full implementation plan
├── .claude/
│   ├── PRD.md           # Product requirements
│   └── DESIGN_DECISIONS.md
└── pnpm-workspace.yaml
```

---

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
- One of: PostgreSQL 14+, MySQL 8+, SQLite 3, or MongoDB 6+ (or Docker)

---

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Postgres

```bash
docker run --rm -d \
  --name feathers-baas-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=feathers_baas \
  -p 5432:5432 \
  postgres:16
```

### 3. Configure environment

```bash
cp packages/core/.env.example packages/core/.env
```

Open `packages/core/.env` and fill in the two required values:

```env
JWT_SECRET=a-random-secret-that-is-at-least-32-chars-long
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=supersecret
```

The `DATABASE_URL` default (`postgres://postgres:postgres@localhost:5432/feathers_baas`) already matches the Docker container above — no change needed if you used the command in step 2.

### 4. Run migrations and seed

```bash
cd packages/core
pnpm db:migrate
pnpm db:seed
```

Expected output:

```
Batch 1 run: 3 migrations
Ran 1 seed files
Admin user seeded: admin@example.com
```

### 5. Start the server

```bash
pnpm dev
```

Expected output:

```
[INFO]: Database connected
[INFO]: Server listening {"host":"0.0.0.0","port":3030,"env":"development"}
```

Server is now running at `http://localhost:3030`.

---

## Testing the API

### Register a user

```bash
curl -s -X POST http://localhost:3030/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}' | jq .
```

Expected: `201` with a user object. The `password` field is never returned.

### Login

```bash
curl -s -X POST http://localhost:3030/authentication \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"local","email":"test@example.com","password":"password123"}' | jq .
```

Expected: `201` with `accessToken` (JWT) and `user` object.

### Make authenticated requests

```bash
TOKEN=$(curl -s -X POST http://localhost:3030/authentication \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"local","email":"test@example.com","password":"password123"}' \
  | jq -r .accessToken)

curl -s http://localhost:3030/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Login as admin (full access)

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3030/authentication \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"local","email":"admin@example.com","password":"supersecret"}' \
  | jq -r .accessToken)

# List all users
curl -s http://localhost:3030/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# List roles
curl -s http://localhost:3030/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### Expected behaviour by scenario

| Request | Expected result |
|---|---|
| `POST /users` | 201, no `password` field in response |
| `POST /users` same email again | 400 "already exists" |
| `POST /users` with `"roles":["admin"]` | 403 Forbidden |
| `POST /authentication` wrong password | 401 Not Authenticated |
| `GET /users` with no token | 401 Not Authenticated |
| `GET /users` with regular user token | 403 Forbidden (user role has no `find` permission) |
| `GET /users` with admin token | 200 paginated list |
| `GET /roles` with admin token | 200 list of roles with permissions |

---

## Auth Management

Built on [`feathers-authentication-management`](https://github.com/feathersjs-ecosystem/feathers-authentication-management), the `authManagement` service handles the full lifecycle of email verification and password reset — no custom code needed.

### How it works

1. **User registers** (`POST /users`) — the `addVerification` hook injects a `verifyToken` and sets `isVerified: false` before the user is saved. A verification email is sent automatically via the configured notification driver.

2. **User clicks the verification link** — your frontend extracts the token from the URL and calls:

```bash
curl -s -X POST http://localhost:3030/authManagement \
  -H 'Content-Type: application/json' \
  -d '{"action":"verifySignupLong","value":"<verifyToken>"}' | jq .
```

3. **The service verifies the token**, checks it hasn't expired, and sets `isVerified: true`.

### Supported actions

| Action | Method | Description |
|---|---|---|
| `verifySignupLong` | POST `/authManagement` | Verify email with the long token from the link |
| `verifySignupShort` | POST `/authManagement` | Verify email with a short token (e.g. 6-digit code) |
| `resendVerifySignup` | POST `/authManagement` | Re-send the verification email |
| `sendResetPwd` | POST `/authManagement` | Send a password reset email |
| `resetPwdLong` | POST `/authManagement` | Reset password using the long token |
| `resetPwdShort` | POST `/authManagement` | Reset password using a short token |
| `passwordChange` | POST `/authManagement` | Change password (requires current password) |
| `identityChange` | POST `/authManagement` | Change email address (requires password) |

### Password reset flow

```bash
# 1. Request a reset email
curl -s -X POST http://localhost:3030/authManagement \
  -H 'Content-Type: application/json' \
  -d '{"action":"sendResetPwd","value":{"email":"user@example.com"}}' | jq .

# 2. User clicks the reset link → your frontend extracts the token and new password
curl -s -X POST http://localhost:3030/authManagement \
  -H 'Content-Type: application/json' \
  -d '{"action":"resetPwdLong","value":{"token":"<resetToken>","password":"newPassword123"}}' | jq .
```

### Verification fields on the user record

These fields are managed automatically — they are **never exposed in API responses** (stripped by the `removeVerification` after-hook):

| Field | Type | Purpose |
|---|---|---|
| `isVerified` | `boolean` | Whether the user's email is verified |
| `verifyToken` | `string` | Long token sent in verification emails |
| `verifyShortToken` | `string` | Short token (e.g. 6-digit code) |
| `verifyExpires` | `timestamp` | When the verification token expires |
| `verifyChanges` | `jsonb` | Pending identity changes |
| `resetToken` | `string` | Long token sent in password reset emails |
| `resetShortToken` | `string` | Short token for password reset |
| `resetExpires` | `timestamp` | When the reset token expires |
| `resetAttempts` | `integer` | Number of reset attempts |

> **Note:** `isVerified` is returned in user responses. All token fields are stripped.

---

## CLI Generators

The `feathers-baas` CLI generates services and hooks with full TypeBox schemas, Knex migrations, and hooks — wired into the app via AST-safe ts-morph patching.

### Generate a service

```bash
npx feathers-baas generate service --name posts --fields "title:string,body:text,publishedAt:date:optional"
```

Creates 5 files and patches 2 existing files:

| File | What it does |
|---|---|
| `src/services/posts/posts.schema.ts` | TypeBox schemas (main, data, patch, query) |
| `src/services/posts/posts.class.ts` | `KnexService` subclass |
| `src/services/posts/posts.hooks.ts` | Hook chain (JWT auth + permission check) |
| `src/services/posts/posts.service.ts` | Service configuration |
| `migrations/<timestamp>_create_posts.ts` | Knex migration |
| `src/services/index.ts` | **Patched** — import + configure call added |
| `src/declarations.ts` | **Patched** — type import + ServiceTypes entry added |

#### Field types

| Type | TypeBox | Knex column |
|---|---|---|
| `string` | `Type.String()` | `string(255)` |
| `text` | `Type.String()` | `text` |
| `integer` | `Type.Integer()` | `integer` |
| `number` | `Type.Number()` | `float` |
| `boolean` | `Type.Boolean()` | `boolean` |
| `date` | `Type.String({ format: 'date-time' })` | `timestamp` |
| `json` | `Type.Object({})` | `jsonb` |

Append `:optional` to any field to make it nullable in the schema and migration.

#### Interactive mode

Run without flags for interactive prompts:

```bash
npx feathers-baas generate service
```

### Generate a hook

```bash
npx feathers-baas generate hook --name slugify
```

Creates `src/hooks/slugify.ts` — a typed hook function ready to add to any service's hook chain.

---

## Database Adapters

feathers-baas supports four database backends. Each generated app uses one — chosen at `init` time.

| Database | Adapter | Driver package | Env var |
|---|---|---|---|
| PostgreSQL | `db/knex.ts` | `pg` | `DATABASE_URL` |
| MySQL | `db/mysql.ts` | `mysql2` | `MYSQL_URL` |
| SQLite | `db/sqlite.ts` | `better-sqlite3` | `SQLITE_FILENAME` |
| MongoDB | `db/mongo.ts` | `mongodb` | `MONGODB_URL` |

### Knex-based adapters (Postgres, MySQL, SQLite)

All three use Knex with automatic camelCase-to-snake_case conversion. Services use `KnexService` from `@feathersjs/knex`. Migrations are standard Knex migration files.

```ts
// Postgres (default)
import { configureKnex } from '@feathers-baas/core/db'
await configureKnex(app)

// MySQL
import { configureMysql } from '@feathers-baas/core/db'
await configureMysql(app)

// SQLite
import { configureSqlite } from '@feathers-baas/core/db'
await configureSqlite(app)
```

SQLite uses a single-connection pool (`{ min: 1, max: 1 }`) since it doesn't support concurrent writes.

### MongoDB adapter

Uses the native `mongodb` driver with a `MongoClient` singleton. Services use `MongoDBService` from `@feathersjs/mongodb`.

```ts
import { configureMongo } from '@feathers-baas/core/db'
await configureMongo(app)
```

Set `MONGODB_URL` and optionally `MONGODB_DB_NAME` in your environment.

---

## Health Checks

Two endpoints, both bypass authentication:

| Endpoint | Purpose | Response |
|---|---|---|
| `GET /health` | Liveness probe | `200 { "status": "ok" }` |
| `GET /health/ready` | Readiness probe | `200` or `503` with check details |

The readiness endpoint checks database connectivity and Redis (if configured):

```bash
curl -s http://localhost:3030/health/ready | jq .
```

```json
{
  "status": "ok",
  "checks": [
    { "name": "database", "status": "ok" },
    { "name": "redis", "status": "ok" }
  ]
}
```

Returns `503` with `"status": "degraded"` if any check fails — ideal for Kubernetes probes.

---

## OpenAPI & Swagger UI

API documentation is auto-generated from TypeBox schemas and served at runtime:

| Endpoint | Description |
|---|---|
| `GET /openapi.json` | OpenAPI 3.1 spec (JSON) |
| `GET /docs` | Interactive Swagger UI (Scalar) |

The spec includes all registered services with their CRUD operations, request/response schemas, and JWT auth. New services added via `generate service` are automatically included when they register their schemas with `registerServiceSchemas()`.

---

## Docker

Docker templates are included for production deployment:

| File | Description |
|---|---|
| `Dockerfile` | Multi-stage build (Node 20 Alpine, non-root user) |
| `docker-compose.yml` | App + Postgres + Redis |
| `.dockerignore` | Excludes dev files, tests, env files |

```bash
# Build and run with Docker Compose
docker compose up -d

# Or build standalone
docker build -t my-api .
docker run -p 3030:3030 --env-file .env my-api
```

The `docker-compose.yml` includes health checks on Postgres and Redis — the app container waits for both to be ready before starting.

---

## CLI Commands

| Command | Description |
|---|---|
| `generate service` | Generate a service (schema, class, hooks, migration) |
| `generate hook` | Generate a typed hook function |
| `doctor` | Check project health (env vars, DB, versions) |
| `describe` | Introspect services, methods, hooks (JSON for agents) |

### `feathers-baas doctor`

Validates your project setup:

```bash
npx feathers-baas doctor
```

```
ℹ Checking project at /path/to/project

✔ env-file: .env file exists
✔ database-url: Database connection configured
✔ jwt-secret: JWT_SECRET is set (32+ chars)
✔ version-consistency: All @feathersjs/* packages at ^5.0.30
✔ migrations: Migrations directory exists

✔ All checks passed!
```

Use `--json` for machine-readable output.

### `feathers-baas describe`

Outputs a JSON description of your project for AI agent consumption:

```bash
npx feathers-baas describe
```

```json
{
  "name": "@feathers-baas/core",
  "version": "0.0.1",
  "services": [
    { "name": "users", "path": "/users", "methods": ["find","get","create","patch","remove"], "files": [...] },
    { "name": "roles", "path": "/roles", "methods": ["find","get","create","patch","remove"], "files": [...] }
  ],
  "hooks": ["authenticate", "permission-check", "log-error"],
  "migrations": ["001_create_users.ts", "002_create_roles.ts", ...],
  "database": "postgresql"
}
```

---

## Notifications (`@feathers-baas/plugin-notifications`)

### How it works

Auth events (verify email, reset password, etc.) are routed through the notification system. Two delivery modes are supported:

- **Direct mode** (no Redis) — drivers are called synchronously in the request path. Suitable for development and API-based drivers (Brevo, Resend, SendGrid).
- **Queue mode** (with Redis) — jobs are enqueued in BullMQ with automatic retries and exponential backoff. Best for production and SMTP.

```
# Direct mode (no Redis)
Auth event → notifier fn → Driver → Brevo | Resend | SendGrid | SMTP

# Queue mode (with Redis)
Auth event → notifier fn → BullMQ queue → Worker → Driver
```

If no driver env vars are configured at all, auth events are logged to console.

### Setup

**1. Add driver env vars** to `packages/core/.env`:

```env
APP_URL=http://localhost:3030

# Pick one (or more) email drivers — all configured drivers receive every event:

# Option A — SMTP (Mailtrap, Postfix, etc.)
SMTP_URL=smtp://user:pass@localhost:1025
SMTP_FROM_NAME=feathers-baas
SMTP_FROM_ADDRESS=no-reply@example.com

# Option B — Resend
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_NAME=feathers-baas
RESEND_FROM_ADDRESS=no-reply@yourdomain.com

# Option C — SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxx
SENDGRID_FROM_NAME=feathers-baas
SENDGRID_FROM_ADDRESS=no-reply@yourdomain.com

# Option D — Brevo
BREVO_API_KEY=xkeysib-xxxxxxxxxxxx
BREVO_FROM_NAME=feathers-baas
BREVO_FROM_ADDRESS=no-reply@yourdomain.com
```

That's it — restart the server and emails will be sent in direct mode:

```
[INFO]: Notifications: Brevo driver registered
[INFO]: Notifications: direct mode (no Redis) — emails sent synchronously
```

**2. (Optional) Add Redis** for queue mode with retries:

```bash
docker run --rm -d --name feathers-baas-redis -p 6379:6379 redis:7
```

```env
REDIS_URL=redis://localhost:6379
```

```
[INFO]: Notifications: Redis connected
[INFO]: Notifications: Brevo driver registered
[INFO]: Notifications: BullMQ queue and worker started
```

### Auth emails sent automatically

| Auth event | Trigger |
|---|---|
| Verify email | User registers |
| Resend verification | User requests re-send |
| Reset password | User requests reset |
| Password changed | After successful reset |
| Password changed | After manual password update |
| Email change | Identity change request |

### Graceful shutdown

When Redis is configured, the BullMQ worker is drained before the process exits — in-flight jobs complete before Redis disconnects.

### Email drivers

| Driver | Class | Env var | When to use |
|---|---|---|---|
| SMTP | `SMTPDriver` | `SMTP_URL` | Self-hosted SMTP, Mailtrap, Postfix |
| Resend | `ResendDriver` | `RESEND_API_KEY` | Managed transactional email |
| SendGrid | `SendGridDriver` | `SENDGRID_API_KEY` | Twilio SendGrid |
| Brevo | `BrevoDriver` | `BREVO_API_KEY` | Brevo (formerly Sendinblue) |

All configured drivers are active simultaneously — every auth event is delivered via each registered driver.

---

## File storage (`@feathers-baas/plugin-files`)

### Installation

```bash
pnpm add @feathers-baas/plugin-files
```

### Setup

Call `configureFiles` in your app bootstrap **after** `configureKnex` and `configureAuth`:

```ts
import { configureFiles, LocalDriver } from '@feathers-baas/plugin-files'

configureFiles(app, {
  driver: new LocalDriver({
    directory: './uploads',
    jwtSecret: config.jwtSecret,
    baseUrl: 'http://localhost:3030',
  }),
  driverType: 'local',
  bucket: 'uploads',
  maxFileSize: 52_428_800,           // 50 MB (default)
  allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'], // optional
})
```

Run the migration after adding the plugin:

```bash
pnpm db:migrate
```

### Drivers

| Driver | Class | When to use |
|---|---|---|
| Local filesystem | `LocalDriver` | Development, single-node deployments |
| AWS S3 (+ MinIO, LocalStack) | `S3Driver` | Production, multi-node |
| Google Cloud Storage | `GCSDriver` | Production on GCP |

**S3Driver** — works with any S3-compatible endpoint (MinIO, LocalStack):

```ts
import { S3Driver } from '@feathers-baas/plugin-files'

new S3Driver({
  bucket: 'my-bucket',
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  // endpoint: 'http://localhost:9000',  // MinIO
  // forcePathStyle: true,               // required for MinIO
})
```

**GCSDriver**:

```ts
import { GCSDriver } from '@feathers-baas/plugin-files'

new GCSDriver({
  bucket: 'my-gcs-bucket',
  // keyFilename: '/path/to/service-account.json',  // or use ADC
})
```

### Uploading a file

Send a `multipart/form-data` POST to `/files` with a JWT in the `Authorization` header:

```bash
curl -s -X POST http://localhost:3030/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@photo.jpg" | jq .
```

Expected response:

```json
{
  "id": "...",
  "key": "3f2a...jpg",
  "bucket": "uploads",
  "driver": "local",
  "mimeType": "image/jpeg",
  "size": 204800,
  "originalName": "photo.jpg",
  "uploadedBy": "...",
  "metadata": {},
  "createdAt": "..."
}
```

Only the `metadata` field is patchable after upload — all other fields are immutable. Deleting a file record also deletes the binary from the driver.

### File storage API

| Method | Path | Description |
|---|---|---|
| `POST` | `/files` | Upload a file (`multipart/form-data`) |
| `GET` | `/files` | List file records (paginated) |
| `GET` | `/files/:id` | Get a file record |
| `PATCH` | `/files/:id` | Update metadata |
| `DELETE` | `/files/:id` | Delete record + binary |

All endpoints require a valid JWT. Uploads are streamed directly to the driver — no temporary buffering.

---

## API

### Services

| Method | Path | Description |
|---|---|---|
| `POST` | `/users` | Register a new user (sends verification email) |
| `GET` | `/users` | List users (admin only) |
| `GET` | `/users/:id` | Get a user |
| `PATCH` | `/users/:id` | Update a user |
| `DELETE` | `/users/:id` | Delete a user |
| `POST` | `/authentication` | Login (returns JWT) |
| `DELETE` | `/authentication` | Logout |
| `POST` | `/authManagement` | Auth actions: verify email, reset password, etc. |
| `GET` | `/roles` | List roles (admin only) |
| `POST` | `/roles` | Create a role (admin only) |
| `PATCH` | `/roles/:id` | Update a role (admin only) |
| `DELETE` | `/roles/:id` | Delete a role (admin only) |

### Roles & permissions

Three roles are seeded by default:

| Role | Permissions |
|---|---|
| `admin` | Full access to all services |
| `user` | `get` and `patch` on `/users` (own profile) |
| `guest` | No permissions |

New users are assigned the `user` role by default. The `admin` role cannot be self-assigned via REST — use the seed or a direct internal call.

Permissions use the format `{ service, methods[] }`:

```json
{
  "name": "editor",
  "permissions": [
    { "service": "posts", "methods": ["find", "get", "create", "patch"] },
    { "service": "users", "methods": ["get"] }
  ]
}
```

Use `"*"` in `methods` to grant access to all methods on a service.

---

## Development

### Run tests

```bash
# Unit tests (no DB required)
pnpm test

# Watch mode
pnpm test:watch
```

### Typecheck

```bash
pnpm typecheck
```

### Build

```bash
pnpm build
```

---

## Architecture

### Bootstrap order

The app bootstraps in a strict order — each step depends on the previous:

```
 1. resolveConfig()              — TypeBox schema validation, fail-fast on bad env
 2. cors + errorHandler()        — outermost Koa middleware (wraps everything below)
 3. bodyParser                   — parse JSON bodies
 4. configureHealth()            — /health + /health/ready (before auth)
 5. configureOpenApi()           — /openapi.json + /docs (before auth)
 6. rest()                       — Koa HTTP transport
 7. configureKnex()              — database connection (SELECT 1 health check)
 8. configureAuth()              — JWT + local strategies (argon2id)
 9. configureServices()          — users, roles
10. configureAuthManagement()    — email verification, password reset (depends on users service)
11. configureChannels()          — real-time channel setup
12. configureNotifications()     — email drivers + optional BullMQ queue
13. logError around hook         — global error logging
```

`errorHandler` must be registered before `rest()` so it wraps the REST transport in Koa's onion model — this is what translates Feathers errors (e.g. `NotAuthenticated`) into correct HTTP status codes (401, 403, etc.) instead of 500.

### Service anatomy

Each service is four files colocated in `src/services/<name>/`:

```
users.schema.ts   — TypeBox schemas (data, patch, query, full row)
users.class.ts    — KnexService subclass
users.hooks.ts    — before/after/error hook chains
users.service.ts  — wires class + hooks, mounts on app
```

### camelCase ↔ snake_case

The database uses snake_case column names (`created_at`, `is_verified`, `deleted_at`, …) while TypeScript schemas use camelCase. Conversion is handled transparently at the Knex level via two standard Knex options in `db/knex.ts`:

- **`wrapIdentifier`** — converts camelCase field names in outgoing queries to snake_case before they hit the DB.
- **`postProcessResponse`** — converts snake_case column names in result rows back to camelCase before returning them to the service layer.

Only top-level result row keys are converted. JSONB field contents (`permissions`, `metadata`, `oauthIds`) are left as-is.

### RBAC

Permissions are stored as JSONB on the `roles` table — no join table. Role names are denormalized onto `users.roles` (a Postgres `text[]` column with a GIN index). The permission check hook uses an LRU cache (5-minute TTL) so role documents are not fetched from the DB on every request.

### Graceful shutdown

On `SIGTERM`/`SIGINT`, the process shuts down in order:

1. Stop accepting new HTTP connections, drain in-flight requests
2. Drain BullMQ notification worker (in-flight jobs complete)
3. Close BullMQ queue and Redis connections
4. Close database connections (Knex or MongoDB)
5. Exit

If shutdown takes longer than 30 seconds, the process force-exits with code 1. The shutdown handler is idempotent — duplicate signals are ignored.

### Security defaults

- Passwords hashed with **argon2id** (OWASP recommended parameters)
- `password` field stripped from all API responses via after hooks
- Admin role cannot be self-assigned via REST
- CORS origin allowlist (configurable via `CORS_ORIGINS`)
- Permission check gated on `isProvider('rest')` — internal CLI calls bypass it

---

## Configuration reference

All configuration is via environment variables (12-factor). See [packages/core/.env.example](packages/core/.env.example) for the full list.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | * | — | Postgres connection string |
| `MYSQL_URL` | * | — | MySQL connection string |
| `SQLITE_FILENAME` | * | — | SQLite database file path |
| `MONGODB_URL` | * | — | MongoDB connection string |
| `MONGODB_DB_NAME` | | — | MongoDB database name (extracted from URL if omitted) |
| `JWT_SECRET` | ✅ | — | HMAC secret, min 32 chars |
| `PORT` | | `3030` | HTTP port |
| `HOST` | | `0.0.0.0` | Bind address |
| `NODE_ENV` | | `development` | `development`, `test`, `production` |
| `JWT_EXPIRY` | | `15m` | Access token lifetime |
| `CORS_ORIGINS` | | `http://localhost:3000` | Comma-separated allowed origins |
| `ADMIN_EMAIL` | | — | Bootstrap admin email (seed only) |
| `ADMIN_PASSWORD` | | — | Bootstrap admin password (seed only) |
| `ARGON2_MEMORY_COST` | | `65536` | argon2 memory cost (KiB) |
| `ARGON2_TIME_COST` | | `3` | argon2 iterations |
| `REDIS_URL` | | — | Redis connection string — enables BullMQ notification queue |
| `APP_URL` | | `http://localhost:3030` | Public base URL used in email links |
| `SMTP_URL` | | — | SMTP connection URL (enables SMTP driver) |
| `SMTP_FROM_NAME` | | `feathers-baas` | SMTP sender display name |
| `SMTP_FROM_ADDRESS` | | — | SMTP verified sender address |
| `RESEND_API_KEY` | | — | Resend API key (enables Resend driver) |
| `RESEND_FROM_NAME` | | `feathers-baas` | Resend sender display name |
| `RESEND_FROM_ADDRESS` | | — | Resend verified sender address |
| `SENDGRID_API_KEY` | | — | SendGrid API key (enables SendGrid driver) |
| `SENDGRID_FROM_NAME` | | `feathers-baas` | SendGrid sender display name |
| `SENDGRID_FROM_ADDRESS` | | — | SendGrid verified sender address |
| `BREVO_API_KEY` | | — | Brevo API key (enables Brevo driver) |
| `BREVO_FROM_NAME` | | `feathers-baas` | Brevo sender display name |
| `BREVO_FROM_ADDRESS` | | — | Brevo verified sender address |

\* Exactly one database env var is required (`DATABASE_URL`, `MYSQL_URL`, `SQLITE_FILENAME`, or `MONGODB_URL`).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Feathers.js v5 |
| Language | TypeScript (strict) |
| HTTP | Koa (`@feathersjs/koa`) |
| Database | Knex (`pg`, `mysql2`, `better-sqlite3`) or native `mongodb` |
| Validation | TypeBox (`@feathersjs/typebox`) |
| Auth | `@feathersjs/authentication` + argon2id + `feathers-authentication-management` |
| File storage | `@feathers-baas/plugin-files` — local / S3 / GCS |
| Multipart parsing | `busboy` (streaming, no temp files) |
| Notifications | `@feathers-baas/plugin-notifications` — BullMQ + SMTP / Resend / SendGrid / Brevo |
| Queue | BullMQ + ioredis (Redis) |
| Logging | pino |
| Testing | Vitest |
| CLI | Clipanion + @inquirer/prompts + ts-morph |
| Build | tsup |
| Package manager | pnpm workspaces |

---

## Contributing

See [PLAN.md](PLAN.md) for the full implementation roadmap and architectural decisions.
See [.claude/DESIGN_DECISIONS.md](.claude/DESIGN_DECISIONS.md) for the rationale behind every major design choice.

---

## License

MIT
