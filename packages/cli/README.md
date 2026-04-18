# feathers-baas

CLI tool for [feathers-baas](https://github.com/anthropics/feathers-baas) — scaffolds and manages production-grade Feathers.js v5 backends.

## Installation

```bash
# Scaffold a new project (no install needed)
npx feathers-baas init my-api

# Or install globally
npm i -g feathers-baas
```

Generated projects include `feathers-baas` as a devDependency for runtime commands like `seed`.

## Commands

### `init [name]`

Scaffold a new feathers-baas project.

```bash
npx feathers-baas init my-api
npx feathers-baas init my-api --database mongodb
npx feathers-baas init my-api --database postgresql --install
```

Options:
- `--database, -d` — `postgresql`, `mysql`, `sqlite`, or `mongodb`
- `--install, -i` — run package manager install after scaffolding

Generates: `package.json`, `tsconfig.json`, `tsup.config.ts`, `.env`, `Dockerfile`, `docker-compose.yml`, `AGENTS.md`, and source files. Fetches latest package versions from npm.

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

### `generate service`

Generate a new service with TypeBox schemas, hooks, and migration.

```bash
npx feathers-baas generate service --name posts --fields "title:string,body:text,publishedAt:date:optional"
```

Creates 5 files and patches 2 existing files via AST (ts-morph):
- `src/services/<name>/<name>.schema.ts`
- `src/services/<name>/<name>.class.ts`
- `src/services/<name>/<name>.hooks.ts`
- `src/services/<name>/<name>.service.ts`
- `migrations/<timestamp>_create_<name>.ts`
- Patches `src/services/index.ts` and `src/declarations.ts`

Field types: `string`, `text`, `integer`, `number`, `boolean`, `date`, `json`. Append `:optional` for nullable fields.

### `generate hook`

Generate a typed hook function.

```bash
npx feathers-baas generate hook --name slugify
```

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
```

Outputs services, methods, hooks, migrations, and database type.

## License

MIT
