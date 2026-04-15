# feathers-baas — Implementation Plan

> Generated from PRD.md + DESIGN_DECISIONS.md  
> Last updated: 2026-04-15

---

## Monorepo Structure

```
feathers-baas/
├── packages/
│   ├── core/                    # @feathers-baas/core — Feathers app, services, hooks
│   ├── cli/                     # feathers-baas (the npx-able CLI)
│   ├── plugin-files/            # Files service + local/S3/GCS drivers
│   └── plugin-notifications/   # BullMQ-backed email/SMS/push
├── tsconfig.base.json
├── vitest.config.ts             # workspace mode
├── pnpm-workspace.yaml
├── .eslintrc.json
├── .prettierrc
└── README.md
```

### `packages/core/` detail

```
packages/core/
├── src/
│   ├── app.ts                      # Feathers app factory
│   ├── configuration.ts            # TypeBox config schema + resolver
│   ├── logger.ts                   # pino setup
│   ├── declarations.ts             # Feathers Application type augmentation
│   ├── channels.ts
│   ├── db/
│   │   ├── index.ts                # DB client factory (Knex/Mongo)
│   │   ├── knex.ts
│   │   ├── mysql.ts
│   │   ├── sqlite.ts
│   │   └── mongo.ts
│   ├── auth/
│   │   ├── index.ts
│   │   ├── strategies/
│   │   │   ├── local.strategy.ts
│   │   │   └── jwt.strategy.ts
│   │   └── notifier.ts             # notifier factory
│   ├── services/
│   │   ├── index.ts                # service registry barrel
│   │   ├── users/
│   │   │   ├── users.service.ts
│   │   │   ├── users.schema.ts     # TypeBox schemas
│   │   │   ├── users.hooks.ts
│   │   │   └── users.class.ts      # KnexService subclass
│   │   └── roles/
│   │       ├── roles.service.ts
│   │       ├── roles.schema.ts
│   │       ├── roles.hooks.ts
│   │       └── roles.class.ts
│   └── hooks/
│       ├── authenticate.ts
│       ├── permission-check.ts     # LRU-cached role lookup
│       └── log-error.ts
├── migrations/
│   ├── 001_create_users.ts
│   ├── 002_create_roles.ts
│   └── 003_create_user_role_index.ts
├── seeds/
│   └── 001_admin_roles.ts
├── test/
│   ├── setup.ts
│   ├── app.test.ts
│   ├── services/
│   │   ├── users.test.ts
│   │   └── roles.test.ts
│   └── hooks/
│       └── permission-check.test.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### `packages/cli/` detail

```
packages/cli/
├── src/
│   ├── index.ts                    # CLI entry point (clipanion)
│   ├── commands/
│   │   ├── init.ts
│   │   ├── generate.ts             # generate service/hook (M3)
│   │   ├── doctor.ts               # (M4)
│   │   └── describe.ts             # (M4)
│   ├── prompts/
│   │   ├── init.prompts.ts
│   │   └── generate.prompts.ts
│   ├── generators/
│   │   ├── app.generator.ts        # orchestrates scaffolding
│   │   ├── service.generator.ts
│   │   └── hook.generator.ts
│   └── utils/
│       ├── output.ts               # --json / pretty printer (never raw console.log)
│       └── template.ts             # EJS rendering helpers
├── templates/
│   ├── app/
│   │   ├── package.json.ejs
│   │   ├── tsconfig.json.ejs
│   │   ├── knexfile.ts.ejs
│   │   ├── vitest.config.ts.ejs
│   │   ├── .env.ejs
│   │   └── src/
│   │       ├── app.ts.ejs
│   │       ├── configuration.ts.ejs
│   │       └── index.ts.ejs
│   ├── service/
│   │   ├── service.ts.ejs
│   │   ├── schema.ts.ejs
│   │   ├── hooks.ts.ejs
│   │   └── class.ts.ejs
│   └── hook/
│       └── hook.ts.ejs
├── test/
│   ├── commands/
│   │   └── init.test.ts
│   └── generators/
│       └── app.generator.test.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

---

## Milestones

### M0 — Monorepo Foundation *(prerequisite, no features)*

1. `pnpm-workspace.yaml` + root `package.json` (devDeps: TypeScript, tsup, vitest, eslint, prettier; Node engine: `>=20.0.0`)
2. `tsconfig.base.json` — strict, ESNext, bundler resolution, declaration + sourceMap
3. Root vitest workspace config (points to `packages/*/vitest.config.ts`)
4. `packages/core/package.json` — name: `@feathers-baas/core`, type: `"module"`
5. `packages/cli/package.json` — name: `feathers-baas`, bin: `./dist/index.js`

---

### M1 — `init` → Runnable App *(Postgres + Auth + Users + Roles)*

#### Critical path (create in this order)

```
tsconfig.base.json
  → declarations.ts
    → configuration.ts
      → logger.ts + db/knex.ts
        → app.ts
          → users + roles services
            → migrations + seeds
              → CLI init command + templates
```

#### Step-by-step

**1.1 — `declarations.ts`**  
Feathers `Application` type augmentation. Every service uses `app.get('knex')`, `app.get('config')` — these must be typed here. Nothing else compiles without this.

**1.2 — `configuration.ts`**  
Pure TypeBox + `process.env`. No `@feathersjs/configuration` JSON files (conflicts with 12-factor/Docker). Exported `resolveConfig()` validates at boot and throws on missing required vars.

Config shape:
```ts
{
  host, port,
  postgres: { url },
  jwtSecret, jwtExpiry,
  argon2: { memoryCost, timeCost, parallelism },
  cors: { origins: string[] },
  nodeEnv
}
```

**1.3 — `logger.ts`**  
Single exported `logger` instance. JSON in production, `pino-pretty` (lazy optional devDep) in development. Must be set up before any other module.

**1.4 — `db/knex.ts`**  
`createKnexClient(config)` → Knex instance. Pool: `{ min: 2, max: 10 }`. Run `knex.raw('SELECT 1')` on startup (fail-fast). Attach to app via `declarations.ts` augmentation.

**1.5 — `app.ts`**  
Bootstrap in this exact order (order matters):
1. `configuration` — schema-validated, fail-fast
2. Security middleware: `koa-helmet`, `cors`
3. Transports: `rest()`, then realtime
4. DB configurator
5. Authentication
6. Services (`services/index.ts`)
7. Channels
8. Terminal middleware: `notFound()`, `errorHandler({ logger })`
9. Global hooks: `around.all: [logError]`

Factory signature: `createApp(): Promise<Application>`

**1.6 — Users schema (`users.schema.ts`)**  
Four TypeBox schemas:
- `userDataSchema` — email + password (required), roles (optional)
- `userPatchSchema` — all optional
- `userQuerySchema`
- `userSchema` — full DB row (id, email, isVerified, isActive, roles: string[], oauthIds, timestamps, verification fields)

`password` appears **only** in `userDataSchema`. Stripped from all outputs via result resolver (not schema filtering).

**1.7 — Users hooks (`users.hooks.ts`)**  
Before-create chain (preserve order):
```
addVerification('auth-management')
setDefaultRoleIfNotProvided()       → ['user'] if empty
iff(isProvider('rest'), preventAdminRegistration())
checkIfItemIsUnique(app, 'email')
validateData
resolveData
```
After-create: `sendVerify()`. After-all: `removeVerification()`.

Result resolver: strip `password` unconditionally. Strip verification/reset tokens unless `context.params.provider === undefined` (internal call).

Patch resolver: re-hash password **only** if `password` field is present in patch data (not unconditionally).

**1.8 — Roles schema + service**  
Schema: `{ id, name, permissions: Array<{ service: string, methods: string[] }>, createdAt, updatedAt }`.  
Permissions stored as JSONB column (not a join table).  
Pre-seeded: `admin` (all), `user` (scoped), `guest` (read-only public).

**1.9 — Permission-check hook (`hooks/permission-check.ts`)**  
LRU cache (use `lru-cache` package) keyed by role name, TTL: 5 minutes.

Algorithm:
1. Fetch roles where `name $in user.roles` (from cache if available)
2. Flatten permissions across roles
3. Find permissions where `service === context.path`
4. Allow if any matched permission's `methods` contains `context.method` or `'*'`
5. Otherwise throw `Forbidden` (not `MethodNotAllowed`)

Gated by `iff(isProvider('rest'), checkPermissions(app))` — internal CLI calls bypass.

**1.10 — Migrations**  
- `001_create_users.ts` — `roles` as `text[]` (Postgres array), `oauth_ids` as JSONB, nullable verification fields
- `002_create_roles.ts` — `permissions` as JSONB
- `003_create_user_role_index.ts` — GIN index on `users.roles`

**1.11 — Seeds (`001_admin_roles.ts`)**  
Idempotent (`INSERT ... ON CONFLICT DO NOTHING`). Seeds three roles + one admin user (credentials from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars, hashed with argon2id at seed time).

**1.12 — Auth (`auth/index.ts`)**  
JWT + local strategies. Local: `usernameField: 'email'`, custom `comparePassword` using `argon2.verify`.  
feathers-authentication-management for verify/reset flows. Notifier stub (logs to console) at M1 — real implementation in M2.

**1.13 — Entry point (`src/index.ts`)**  
Call `createApp()`, start Koa, handle `SIGTERM`/`SIGINT` (close DB pool, close HTTP server). Log startup time.

#### CLI (M1)

**Init prompts (`prompts/init.prompts.ts`)**  
Use `@inquirer/prompts` (not legacy inquirer):
1. Project name (validate: lowercase + hyphens)
2. Database (only postgres enabled in M1, others grayed out)
3. Package manager (pnpm / npm / yarn)

**App generator (`generators/app.generator.ts`)**  
Render EJS templates → write to target dir → copy static assets → run install → run migrations → print next steps.  
Fail if target dir exists (unless `--force`).

**Init command (`commands/init.ts`) — clipanion**  
Supports interactive + `--flag` mode + `--json` output. `--json` suppresses all prompts, requires flags, emits `{ success: true, path }` or `{ success: false, error }`.

**Output utility (`utils/output.ts`)**  
All CLI output goes through this. Never raw `console.log`. Supports `--json` mode (no spinners/colors, structured JSON) and pretty mode (ora + chalk).

#### M1 Tests

| Type | What |
|---|---|
| Unit | Schema validation, hook logic (mock context), config parsing |
| Integration (real DB) | Users CRUD, auth flow, role permission check, duplicate email |
| CLI | Template rendering to `os.tmpdir()`, init dry-run (mock child_process) |

Test isolation: wrap each DB test in a Knex transaction, roll back in `afterEach`. Never truncate tables.

---

### M2 — Files + Notifications

**Files plugin (`plugin-files/`)**

Driver interface:
```ts
interface FileDriver {
  put(key: string, stream: Readable, meta: FileMeta): Promise<FileRecord>
  get(key: string): Promise<Readable>
  delete(key: string): Promise<void>
  signUrl(key: string, expiresIn: number): Promise<string>
  list(prefix: string): Promise<FileRecord[]>
}
```

Drivers:
- `local.driver.ts` — `fs/promises` + stream, `signUrl` uses JWT-signed URL
- `s3.driver.ts` — `@aws-sdk/client-s3` v3 + `@aws-sdk/s3-request-presigner`, `Upload` for multipart
- `gcs.driver.ts` — `@google-cloud/storage`

Files metadata in DB: `{ id, key, bucket, driver, mimeType, size, originalName, uploadedBy, metadata: JSONB, createdAt }`.  
Migration: `004_create_files.ts`.

Multipart upload: `@koa/multer` (or `busboy`) middleware attaches stream to `params.stream`.

**Notifications plugin (`plugin-notifications/`)**

Registry pattern:
```ts
type NotifierDriver = { send(notification: Notification): Promise<void> }
const registry = new Map<string, NotifierDriver>()
```

BullMQ: one `Worker`, concurrency: 5. Job data: `{ driverName, notification }`. Worker looks up driver from registry → calls `send`.  
Redis: `ioredis`. Retry: exponential backoff.

Drivers in M2: SMTP (nodemailer), Resend. Templates: EJS strings stored in notification payload.

Replace M1 auth notifier stub with real BullMQ-enqueuing notifier. Keep sync fallback if no queue configured.

**M2 Tests**

- Local driver: real temp files, `put`/`get`/`delete`
- S3 driver: mock `@aws-sdk/client-s3`
- BullMQ: `ioredis-mock` by default; real Redis with `INTEGRATION=true`

---

### M3 — Code Generators + DB Agnosticism

**`generate service <name>`**  
Creates 4 files under `src/services/<name>/`. Patches `src/services/index.ts` **using ts-morph** (never regex on TypeScript source).

**`generate hook <name>`**  
Creates `src/hooks/<name>.ts`, optionally patches a specified service's hooks file.

**New DB adapters**
- `db/mysql.ts` — Knex + `mysql2`
- `db/sqlite.ts` — Knex + `better-sqlite3` (pool: `{ min: 1, max: 1 }`)
- `db/mongo.ts` — native `mongodb` driver (not Mongoose). `MongoClient` singleton.

Template variants: `service.knex.ts.ejs`, `service.mongo.ts.ejs`. Generator selects based on configured adapter.

CLI init prompt: MySQL/SQLite/MongoDB options now enabled.

**M3 Tests**

- AST patch function: unit tests with fixture input/expected output strings
- Generator: assert file tree in `os.tmpdir()`
- MySQL/SQLite/MongoDB: Docker Compose services in CI

---

### M4 — Production Polish

**OpenAPI**  
Generate 3.1 spec from TypeBox schemas. TypeBox schemas are JSON Schema-compatible — emit directly with a thin wrapper that adds paths from the service registry. Serve at `/openapi.json`. Swagger UI via `@scalar/koa` at `/docs`.

**Health checks**
- `GET /health` — liveness: `{ status: 'ok' | 'degraded' }`
- `GET /health/ready` — readiness: checks DB (`SELECT 1`) + Redis (`PING`). Returns 503 if degraded. Bypasses auth.

**Graceful shutdown**  
Extend M1 implementation: drain BullMQ workers → close Redis → drain in-flight requests → close HTTP server. 30s timeout then force exit.

**Docker artifacts** (generated into scaffolded app)
- `Dockerfile`: multi-stage (builder → runner), Node 20 Alpine, non-root user
- `docker-compose.yml`: app + postgres + redis
- `.dockerignore`

**`feathers-baas doctor`**  
Checks: required env vars, DB connectivity, Redis connectivity, pending migrations, `@feathersjs/*` version consistency.  
Output: checklist (pretty) or `{ checks: [...] }` (`--json`).

**`feathers-baas describe`**  
Introspects registered services, methods, and schemas. Requires CLI to run from project root. Outputs JSON for agent consumption.

**`AGENTS.md`**  
Template file generated into scaffolded apps. Documents: codebase structure, safe-to-edit vs. generated files, how to add a service, env vars reference, test commands.

**M4 Tests**

- Health endpoint: mock DB/Redis, assert 200 vs. 503
- OpenAPI: snapshot test (detect schema drift)
- Graceful shutdown: integration test — SIGTERM → assert stops within 35s
- Doctor: mock filesystem + DB connection

---

### M5 — Plugin System + npm Publish

**Plugin interface**
```ts
interface FeathersBaasPlugin {
  name: string
  version: string
  install(app: Application, options: Record<string, unknown>): Promise<void>
  getTemplates?(): PluginTemplates
  getGenerators?(): PluginGenerators
}
```

**Plugin discovery**  
Scan `package.json` dependencies for packages with `"feathers-baas-plugin": true` keyword. No postinstall magic.

**Build pipeline**  
Each package: `tsup` with `format: ['esm', 'cjs']`, `dts: true`, `splitting: false`, `clean: true`.  
Root build: `pnpm -r build`.

**Publish**  
Use `@changesets/cli`. CI: `changeset version` on merge to main → `changeset publish`.  
CLI package (`feathers-baas`) published unscoped for `npx feathers-baas` ergonomics.  
All packages: `"publishConfig": { "access": "public" }`.

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Config | Pure TypeBox + env vars | No JSON config files — cleaner 12-factor, Docker-friendly |
| Template engine | EJS for generation, ts-morph for patching existing files | EJS is simple; ts-morph prevents regex-on-TypeScript disasters |
| Role permissions storage | JSONB in `roles` table | LRU cache covers hot paths; join table only needed for "who can access X" queries |
| Password hashing | argon2id | OWASP recommendation; document native dep, ship pre-built Docker image |
| ESM strategy | ESM-only for `core`, dual ESM/CJS for packages | Feathers v5 forces ESM; dual output maximizes consumer compat |
| DB attachment to app | `declarations.ts` type augmentation | Typed `app.get('knex')` everywhere, no untyped `app.set` |
| Role deduplication | Roles referenced by name (string[]) on users | Agent-friendly, no join for permission checks |
| Internal CLI calls | Direct module import for generators, HTTP for live-server commands | Avoids tight coupling except where needed |

---

## Test Rules (All Milestones)

- **DB isolation:** wrap each test in a Knex transaction, roll back in `afterEach`. Never truncate tables.
- **BullMQ:** use `ioredis-mock` by default; real Redis with `INTEGRATION=true` env var in CI.
- **Generator tests:** always write to `os.tmpdir()`, clean up in `afterAll`.
- **No test may depend on execution order.** Each file is fully independent.
- **CI matrix:** Node 20 + Node 22, Ubuntu latest, Postgres 16, Redis 7 as Docker services.
- Run `pnpm -r build` before tests in CI to catch compile errors early.

---

## Test Coverage Per Milestone

| Milestone | Unit (no I/O) | Integration (real DB/Redis) | CLI/Generator | Snapshot |
|---|---|---|---|---|
| M0 | tsconfig compilation | — | — | — |
| M1 | Schema validation, hook logic, config parsing | Users CRUD, auth flow, role permissions | Template rendering, init dry-run | — |
| M2 | Driver interface, notifier registry, queue job shape | Local file driver, BullMQ + ioredis-mock | — | — |
| M3 | AST patch function, generator logic | MySQL/SQLite/MongoDB adapters | generate service → assert file tree | — |
| M4 | Health check logic, doctor checks | Graceful shutdown (SIGTERM timing) | — | OpenAPI spec |
| M5 | Plugin discovery scanner | — | Build pipeline (dist/ exists) | — |

---

## Success Criteria (from PRD)

- `npx feathers-baas init` → first authenticated API call in **< 5 minutes**
- A Claude Code agent can add a new resource in **one prompt** with > 90% success rate
- 1,000 GitHub stars within 6 months
- 10 community plugins within 12 months
