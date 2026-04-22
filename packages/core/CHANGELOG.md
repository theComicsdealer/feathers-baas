# @feathers-baas/core

## 0.3.2

### Patch Changes

- Make token refresh compatible with `@feathersjs/authentication-client`

  The previous `/authentication/refresh` endpoint was outside the Feathers auth client flow — `reAuthenticate()` only knows how to call `POST /authentication`, so an expired access token always failed.

  The refresh token is now stored in an **HTTP-only cookie** (`feathers-refresh`) at login. A custom `BaasJWTStrategy` reads this cookie when it detects a `TokenExpiredError`: it verifies the refresh token, looks up the user, and returns an auth result that causes `AuthenticationService` to issue a fresh access token — all inside the standard `POST /authentication` call that `reAuthenticate()` makes.

  Browser clients using `@feathersjs/authentication-client` now get transparent token refresh with no client-side changes. Non-browser / API clients can still use `POST /authentication/refresh` with the `refreshToken` from the login response body.

  Logout (`DELETE /authentication`) clears the refresh cookie.

## 0.3.1

### Patch Changes

- Fix generated service hooks failing to resolve `setTimestamps` and `checkPermissions` in external projects

  The hooks template was importing both helpers via relative paths (`../../hooks/...`) that only resolve inside the monorepo itself. Generated projects now import them from `@feathers-baas/core` instead. `setTimestamps` has been added to the core public exports.

## 0.3.0

### Minor Changes

- Fix cross-user patch vulnerability and implement refresh token flow

  **Security fix:** regular users could previously `patch`, `update`, or `delete` any user record including admins. A new `enforceSelfPatch` hook now blocks non-admin callers from acting on any record other than their own. Bulk operations without an explicit `id` are also rejected.

  **Refresh tokens:** `POST /authentication` with `strategy: local` now returns a `refreshToken` alongside `accessToken`. The refresh token is a separate JWT signed with `typ: refresh` and a longer expiry (`JWT_REFRESH_EXPIRY`, default `7d`). Exchange it for a new access token at `POST /authentication/refresh` without re-entering credentials. Access tokens and refresh tokens are rejected at each other's endpoints.

  **Generated service timestamps:** new services now include `createdAt`, `updatedAt`, and optional `deletedAt` fields in their schema, and the `setTimestamps` hook is wired into `create` and `patch` by default.

## 0.2.8

### Patch Changes

- Export `checkPermissions`, `invalidateRoleCache`, and `parseRolePermissions` from public API

## 0.2.7

### Patch Changes

- Fix jsonb serialization in `RolesClass`: override `_create`/`_patch` to JSON.stringify permissions before insert/patch, preventing "invalid input syntax for type json" when seed bypasses hook chain

## 0.2.6

### Patch Changes

- Fix RBAC permission check: support service wildcard '\*', use \_find to bypass auth hooks during role resolution, and parse JSON permissions from SQL databases

## 0.2.5

### Patch Changes

- Add README for each package, update AGENTS.md template, fix MongoDB auth entityId, and add timestamp hooks for consistent createdAt/updatedAt across all databases
- Updated dependencies
  - @feathers-baas/plugin-notifications@0.2.1

## 0.2.4

### Patch Changes

- Updated dependencies
  - @feathers-baas/plugin-notifications@0.2.0

## 0.2.3

### Patch Changes

- Expose ./package.json subpath in package exports to fix plugin discovery resolution
- Updated dependencies
  - @feathers-baas/plugin-notifications@0.1.1

## 0.2.2

### Patch Changes

- Fix plugin discovery resolution, read CLI version from package.json at runtime, and fetch latest package versions from npm when scaffolding new projects

## 0.2.1

### Patch Changes

- Fix package exports: main entry now points to exports.js/exports.cjs (where createApp and seedDatabase are exported) instead of the non-existent index.cjs

## 0.2.0

### Minor Changes

- Add database seeding: `feathers-baas seed` CLI command creates default roles (admin, user) and admin user from ADMIN_EMAIL/ADMIN_PASSWORD env vars

## 0.1.4

### Patch Changes

- 558eb6a: Fix MongoDB support: service configurators now branch on database type, using MongoDBService classes when MongoDB is configured instead of requiring Knex

## 0.1.3

### Patch Changes

- 4b0feef: Fixed database auto-detection issue. App now auto-detects the database from whichever env var is set.

## 0.1.2

### Patch Changes

- 1b4cb4e: Fix tsup config to externalize all package imports — prevents bundling mongodb/pg and Node built-ins into dist

## 0.1.1

### Patch Changes

- a9c9d92: Add configureServices option to createApp for extending the app with additional services

## 0.1.0

### Minor Changes

- a22281b: Initial release — Feathers.js v5 app factory with JWT + local auth, users/roles services, RBAC with LRU-cached permissions, email verification and password reset via feathers-authentication-management, health checks, OpenAPI 3.1 spec generation, plugin auto-discovery, and support for PostgreSQL, MySQL, SQLite, and MongoDB.

### Patch Changes

- Updated dependencies [a22281b]
  - @feathers-baas/plugin-notifications@0.1.0
