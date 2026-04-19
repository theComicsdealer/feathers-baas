# feathers-baas

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
