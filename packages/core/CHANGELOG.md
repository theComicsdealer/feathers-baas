# @feathers-baas/core

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
