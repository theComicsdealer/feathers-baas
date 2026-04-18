# @feathers-baas/core

Core app factory for [feathers-baas](https://github.com/anthropics/feathers-baas) — a production-grade Feathers.js v5 backend framework.

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
- **Authentication** — JWT + local strategy with `feathers-authentication-management` for email verification and password reset
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

## License

MIT
