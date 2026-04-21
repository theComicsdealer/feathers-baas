# feathers-baas

## 0.4.0

### Minor Changes

- Add `ref` field type and `--populate` flag to `generate service`
  - New `ref` field type declares a foreign-key (or MongoDB reference) relationship:
    `authorId:ref:users` or `authorId:ref:users:optional`
  - SQL adapters emit a proper FK constraint (`references('id').inTable(...).onDelete('RESTRICT')`) and an index in the generated migration
  - MongoDB adapters generate a plain `Type.String()` field (no FK concept)
  - New `--populate` flag generates a batched `populateRefs` after hook on `get` and `find` that resolves ref fields to full records (no N+1: uses `_find` + `$in` per ref type)
  - Populated key is derived automatically: `authorId` → `author`, `categoryId` → `category`
  - Add `date` as a first-class scalar field type (`Type.String({ format: 'date-time' })` / `timestamp` column)
  - `ref` fields are automatically queryable (`GET /posts?authorId=xxx` works out of the box)

## 0.3.13

### Patch Changes

- Generate `src/declarations.ts` with `Application` re-export and `ServiceTypes` interface — fixes "Cannot find module '../../declarations.js'" in generated services; the file is also patched by `feathers-baas generate service` to add service type entries
- Add `registerServiceSchemas` call to generated service files so they appear in the OpenAPI spec at `/openapi.json` and `/docs`

## 0.3.12

### Patch Changes

- Generate `src/hooks/permission-check.ts` with standalone RBAC implementation — fixes ERR_MODULE_NOT_FOUND for that local import in generated service hooks
- Add `@feathersjs/errors` and `lru-cache` as direct dependencies in generated projects (required by the permission-check hook)

## 0.3.11

### Patch Changes

- Add `feathers-hooks-common` as a direct dependency in generated projects — fixes ERR_MODULE_NOT_FOUND under pnpm strict hoisting when generated hook files import it

## 0.3.10

### Patch Changes

- Add `@feathersjs/knex`, `@feathersjs/mongodb`, `@feathersjs/authentication`, `@feathersjs/feathers`, and `@feathersjs/typebox` as direct dependencies in generated projects — fixes ERR_MODULE_NOT_FOUND under pnpm's strict hoisting when generated services import these packages

## 0.3.9

### Patch Changes

- Add `feathers-baas migrate` and `feathers-baas rollback` CLI commands backed by programmatic Knex API (tsx-loaded); drop `db:migrate`/`db:seed`/`db:rollback` knex-cli scripts
- Ship default core migrations with generated PostgreSQL projects (roles, users, user_role index, files tables)
- Update generated `package.json` scripts to use `npx feathers-baas migrate/rollback/seed`
- Update `feathers-baas init` next-steps output to use CLI-form commands with SQL-only annotation for migrate

## 0.3.8

### Patch Changes

- Add `knex` as a direct dependency in generated SQL projects so `./node_modules/knex/bin/cli.js` resolves under pnpm's strict module layout — fixes `pnpm db:migrate` failing with ERR_MODULE_NOT_FOUND.

## 0.3.7

### Patch Changes

- Fix service generator to respect project database: auto-detect MongoDB/SQL from package.json and emit MongoDBService class + mongo collection wiring (no migration file) for MongoDB projects, Knex otherwise. Add `--database` flag to override detection.

## 0.3.6

### Patch Changes

- Fix seed command: resolve ESM entry from core package exports map to ensure import.meta.url is available in loaded modules

## 0.3.5

### Patch Changes

- Fix seed command: use dynamic ESM import instead of CJS require to preserve import.meta.url in loaded packages

## 0.3.4

### Patch Changes

- Add README for each package, update AGENTS.md template, fix MongoDB auth entityId, and add timestamp hooks for consistent createdAt/updatedAt across all databases

## 0.3.3

### Patch Changes

- Fix plugin discovery resolution, read CLI version from package.json at runtime, and fetch latest package versions from npm when scaffolding new projects

## 0.3.2

### Patch Changes

- Fix seed command resolving @feathers-baas/core from project node_modules instead of CLI install location; add CLI as devDependency in generated projects

## 0.3.1

### Patch Changes

- Fix seed command: replace dotenv dependency with built-in .env parser to avoid missing package error

## 0.3.0

### Minor Changes

- Add database seeding: `feathers-baas seed` CLI command creates default roles (admin, user) and admin user from ADMIN_EMAIL/ADMIN_PASSWORD env vars

## 0.2.1

### Patch Changes

- 1b4cb4e: Add init command and include plugin packages in generated project dependencies

## 0.2.0

### Minor Changes

- a9c9d92: Add init command — scaffolds a new project with database selection, Docker files, and AGENTS.md

## 0.1.0

### Minor Changes

- a22281b: Initial release — CLI with `generate service` (TypeBox schemas, Knex migration, AST-safe patching via ts-morph), `generate hook`, `doctor` (project health checks), and `describe` (service introspection for AI agents).
