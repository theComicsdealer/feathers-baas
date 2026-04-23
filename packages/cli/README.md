# feathers-baas

CLI tool for [feathers-baas](https://github.com/theComicsdealer/feathers-baas) — scaffolds and manages production-grade Feathers.js v5 backends.

## Installation

```bash
# Scaffold a new project (no install needed)
npx feathers-baas init my-api

# Or install globally
npm i -g feathers-baas
```

Generated projects include `feathers-baas` as a devDependency for runtime commands like `seed` and `migrate`.

---

## Commands

### `init [name]`

Scaffold a new feathers-baas project.

```bash
npx feathers-baas init my-api
npx feathers-baas init my-api --database mongodb
npx feathers-baas init my-api --database postgresql --storage s3 --email resend --install
```

Options:

| Flag | Values | Default |
|---|---|---|
| `--database, -d` | `postgresql`, `mysql`, `sqlite`, `mongodb` | prompted |
| `--storage` | `local`, `s3`, `gcs`, `none` | prompted |
| `--email` | `none`, `smtp`, `resend`, `sendgrid`, `brevo` | prompted |
| `--install, -i` | — | `false` |

Generates: `package.json`, `tsconfig.json`, `tsup.config.ts`, `.env`, `Dockerfile`, `docker-compose.yml`, `AGENTS.md`, and source files. Fetches latest package versions from npm. The generated `.env` includes uncommented env vars for the chosen storage and email drivers.

---

### `migrate`

Run pending Knex migrations (SQL databases only — no-op for MongoDB).

```bash
npx feathers-baas migrate
```

Idempotent — safe to run multiple times.

### `rollback`

Roll back the last migration batch.

```bash
npx feathers-baas rollback
```

---

### `seed`

Seed default roles and admin user from `.env`.

```bash
npx feathers-baas seed
```

Creates:
- **admin** role — full access to all services (`*`)
- **user** role — `get` and `patch` on users service
- Admin user from `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars (auto-verified)

Idempotent — safe to run multiple times.

---

### `generate service`

Generate a new service with TypeBox schemas, hooks, and migration.

```bash
npx feathers-baas generate service --name posts --fields "title:string,body:text,publishedAt:date:optional"
```

Creates 5 files and patches 2 existing files via AST (ts-morph):

| File | What it creates |
|---|---|
| `src/services/<name>/<name>.schema.ts` | TypeBox schemas (main, data, patch, query) |
| `src/services/<name>/<name>.class.ts` | `KnexService` / `MongoDBService` subclass |
| `src/services/<name>/<name>.hooks.ts` | Hook chain (JWT auth + permission check + timestamps) |
| `src/services/<name>/<name>.service.ts` | Service configuration |
| `migrations/<timestamp>_create_<name>.ts` | Knex migration (SQL only) |
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
| `ref:<service>` | `Type.String({ format: 'uuid' })` | `uuid` FK with `REFERENCES <service>(id)` |

Append `:optional` to any field to make it nullable.

#### Foreign keys (`ref` type)

Declare a field as a FK to another service's `id`:

```bash
npx feathers-baas generate service \
  --name posts \
  --fields "title:string,authorId:ref:users"
```

Generates a UUID column with `REFERENCES users(id) ON DELETE RESTRICT` and a covering index.

#### Populate related records (`--populate`)

Add `--populate` to generate a `populateRefs` after-hook that replaces FK fields with the related record on `get` and `find` responses:

```bash
npx feathers-baas generate service \
  --name posts \
  --fields "title:string,authorId:ref:users" \
  --populate
```

`authorId` → `author: { id, email, … }` on every response. Uses a single batched `_find` with `$in` — no N+1 queries.

#### Interactive mode

Run without flags for step-by-step prompts:

```bash
npx feathers-baas generate service
```

---

### `generate hook`

Generate a typed hook function.

```bash
npx feathers-baas generate hook --name slugify
```

Creates `src/hooks/slugify.ts`.

---

### `auth list-roles`

List all roles and their permissions.

```bash
npx feathers-baas auth list-roles          # pretty table
npx feathers-baas auth list-roles --json   # raw JSON
```

### `auth create-role`

Create a new role with permissions (interactive).

```bash
npx feathers-baas auth create-role
npx feathers-baas auth create-role --name editor
```

Prompts for service names and method selections in a loop until done.

### `auth add-permissions`

Add a permission to an existing role.

```bash
# Interactive (select role and fill in permission)
npx feathers-baas auth add-permissions

# Non-interactive (all flags — suitable for scripts/CI)
npx feathers-baas auth add-permissions --role editor --service posts --methods find,get,create
```

### `auth remove-permissions`

Remove one or more permissions from a role (checkbox picker).

```bash
npx feathers-baas auth remove-permissions
npx feathers-baas auth remove-permissions --role editor
```

### `auth create-admin`

Create a new admin user. Password is hashed via the users service hooks; account is auto-verified.

```bash
# Interactive (prompts for email + password with confirmation)
npx feathers-baas auth create-admin

# Non-interactive
npx feathers-baas auth create-admin --email admin@example.com --password secret123
```

> All `auth` commands boot the project app (loads `.env`, connects to the database) the same way as `seed` and `migrate`.

---

### `doctor`

Check project health and configuration.

```bash
npx feathers-baas doctor
npx feathers-baas doctor --json
```

Checks: `.env` file, database URL, JWT secret length, `@feathersjs/*` version consistency, migrations directory.

### `describe`

Introspect project structure as JSON (designed for AI agent consumption).

```bash
npx feathers-baas describe
npx feathers-baas describe --path ./my-app
```

Outputs services, methods, hooks, migrations, and detected database type.

---

## Further reading

The [monorepo README](https://github.com/theComicsdealer/feathers-baas#readme) covers:

- JWT authentication internals (access tokens, refresh tokens, HTTP-only cookie flow)
- RBAC permission check hook and LRU caching
- Auth management (email verification, password reset flows)
- File storage setup and driver configuration (local, S3, GCS)
- Notification system (BullMQ queue, SMTP / Resend / SendGrid / Brevo drivers)
- Database adapters (Knex camelCase↔snake_case, MongoDB)
- Health check and OpenAPI endpoints
- Docker deployment
- Plugin system (writing and auto-discovering plugins)
- Full environment variable reference
- App bootstrap order and architecture

---

## License

MIT
