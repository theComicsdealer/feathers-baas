# @feathers-baas/core

Core app factory for [feathers-baas](https://github.com/theComicsdealer/feathers-baas) — a production-grade Feathers.js v5 backend framework.

## Installation

```bash
pnpm add @feathers-baas/core
```

## Usage

```ts
import { createApp, logger } from '@feathers-baas/core'

const app = await createApp()
const config = app.get('config')
await app.listen(config.port)
logger.info({ port: config.port }, 'Server listening')
```

## What's included

- **App factory** (`createApp`) — boots a fully configured Feathers.js v5 app with typed config, middleware, auth, services, and plugins
- **Database adapters** — PostgreSQL, MySQL, SQLite (via Knex), and MongoDB (native driver). Auto-detected from environment variables
- **Built-in services** — users (with argon2id password hashing, email verification) and roles (RBAC with JSONB permissions, LRU-cached)
- **Authentication** — JWT + local strategy (argon2id) with `feathers-authentication-management` for email verification and password reset
- **Refresh tokens** — `POST /authentication/refresh` for API clients, plus an `HttpOnly` refresh cookie that the JWT strategy uses to renew expired access tokens transparently (works cross-origin: credentialed CORS, `SameSite=None; Secure` when needed)
- **Health checks** — `GET /health` (liveness) and `GET /health/ready` (readiness with DB and Redis checks)
- **OpenAPI** — auto-generated OpenAPI 3.1 spec at `/openapi.json` and Swagger UI at `/docs`
- **Plugin system** — auto-discovers and installs plugins from `package.json` dependencies
- **Database seeding** (`seedDatabase`) — creates default roles and admin user from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars
- **Graceful shutdown** — sequential drain of HTTP, BullMQ, and database connections with 30s timeout

## Database support

| Database   | Env var           | Adapter        |
|------------|-------------------|----------------|
| PostgreSQL | `DATABASE_URL`    | Knex + `pg`    |
| MySQL      | `MYSQL_URL`       | Knex + `mysql2`|
| SQLite     | `SQLITE_FILENAME` | Knex + `better-sqlite3` |
| MongoDB    | `MONGODB_URL`     | Native `mongodb` driver |

Exactly one database must be configured. Knex adapters auto-convert between camelCase (TypeScript) and snake_case (DB columns).

## Configuration

All configuration is via environment variables. See the [root README](../../README.md#configuration-reference) for the full reference.

Required:
- One database env var (see above)
- `JWT_SECRET` (min 32 characters)

For a frontend on another domain, also see `CORS_ORIGINS`, `CORS_CREDENTIALS`, `REFRESH_COOKIE_SAMESITE` and `TRUST_PROXY`; for auth emails, `APP_URL` (the **web app** URL) and the `EMAIL_*_PATH` variables.

## API

### `createApp(options?)`

Creates and returns a configured Feathers application.

```ts
interface CreateAppOptions {
  configureServices?: (app: Application) => void
}
```

The optional `configureServices` callback is called after built-in services are registered, allowing you to add custom services.

### `seedDatabase(app)`

Seeds default roles (`admin`, `user`) and creates an admin user from `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Idempotent — safe to run multiple times.

### `registerServiceSchemas(name, schemas)`

Registers TypeBox schemas for a service, enabling OpenAPI spec generation.

### `generateOpenApiSpec(app)`

Returns an OpenAPI 3.1 JSON spec built from all registered service schemas.

### `sanitizeUser(user)` / `VERIFICATION_FIELDS`

Returns a copy of a user without `password` and the `feathers-authentication-management` fields (`verifyToken`, `resetToken`, …). The `removeVerification` hook only strips those for external calls, so use this whenever a user read with an internal service call is returned to a client.

```ts
import { sanitizeUser } from '@feathers-baas/core'

const user = sanitizeUser(await app.service('users').get(userId))
```

## License

MIT
