# feathers-baas

A CLI tool that scaffolds and runs a **production-grade Feathers.js v5 backend** with the batteries-included experience of Supabase or Firebase — self-hosted, database-agnostic, and optimized for agentic coding environments.

```bash
npx feathers-baas init my-api
```

---

## Why

Feathers.js is the most under-appreciated Node backend framework for the agentic-coding era. Its service-oriented model maps 1:1 to how LLMs reason about CRUD APIs. `feathers-baas` exposes that as a turnkey product.

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

> **M1 complete** — runnable Feathers.js v5 app with Postgres, JWT auth, users, and RBAC roles.

| Milestone | Status | What ships |
|---|---|---|
| M1 — Skeleton | ✅ Done | Auth, users, roles, Postgres, migrations |
| M2 — Storage & Notifications | 🔜 Next | Files (S3/GCS/local), email + BullMQ queue |
| M3 — Generators & DB agnosticism | 📋 Planned | `generate service`, MySQL/SQLite/MongoDB |
| M4 — Production polish | 📋 Planned | OpenAPI, Docker, health checks, `doctor` |
| M5 — Plugin system | 📋 Planned | Plugin loader, npm publish |

---

## Monorepo structure

```
feathers-baas/
├── packages/
│   ├── core/          # @feathers-baas/core — the Feathers app factory
│   └── cli/           # feathers-baas — the npx-able CLI (M1 CLI in progress)
├── PLAN.md            # Full implementation plan
├── .claude/
│   ├── PRD.md         # Product requirements
│   └── DESIGN_DECISIONS.md
└── pnpm-workspace.yaml
```

---

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
- PostgreSQL 14+ (or Docker)

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

## API

### Services

| Method | Path | Description |
|---|---|---|
| `POST` | `/users` | Register a new user |
| `GET` | `/users` | List users (admin only) |
| `GET` | `/users/:id` | Get a user |
| `PATCH` | `/users/:id` | Update a user |
| `DELETE` | `/users/:id` | Delete a user |
| `POST` | `/authentication` | Login (returns JWT) |
| `DELETE` | `/authentication` | Logout |
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
1. resolveConfig()          — TypeBox schema validation, fail-fast on bad env
2. cors + bodyParser        — security middleware
3. rest()                   — Koa HTTP transport
4. configureKnex()          — Postgres connection (SELECT 1 health check)
5. configureAuth()          — JWT + local strategies (argon2id)
6. configureServices()      — users, roles
7. configureChannels()      — real-time channel setup
8. errorHandler()           — terminal middleware
9. logError around hook     — global error logging
```

### Service anatomy

Each service is four files colocated in `src/services/<name>/`:

```
users.schema.ts   — TypeBox schemas (data, patch, query, full row)
users.class.ts    — KnexService subclass
users.hooks.ts    — before/after/error hook chains
users.service.ts  — wires class + hooks, mounts on app
```

### RBAC

Permissions are stored as JSONB on the `roles` table — no join table. Role names are denormalized onto `users.roles` (a Postgres `text[]` column with a GIN index). The permission check hook uses an LRU cache (5-minute TTL) so role documents are not fetched from the DB on every request.

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
| `DATABASE_URL` | ✅ | — | Postgres connection string |
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

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Feathers.js v5 |
| Language | TypeScript (strict) |
| HTTP | Koa (`@feathersjs/koa`) |
| Database | Knex + `pg` (Postgres) |
| Validation | TypeBox (`@feathersjs/typebox`) |
| Auth | `@feathersjs/authentication` + argon2id |
| Logging | pino |
| Testing | Vitest |
| Build | tsup |
| Package manager | pnpm workspaces |

---

## Contributing

See [PLAN.md](PLAN.md) for the full implementation roadmap and architectural decisions.
See [.claude/DESIGN_DECISIONS.md](.claude/DESIGN_DECISIONS.md) for the rationale behind every major design choice.

---

## License

MIT
