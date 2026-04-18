# feathers-baas

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
