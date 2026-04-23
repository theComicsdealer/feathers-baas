# @feathers-baas/plugin-files

## 0.2.2

### Patch Changes

- Add `files` service and `authManagement` service to the OpenAPI docs.
  - `configureOpenApi` now stores `registerServiceSchemas` on the app so external plugins can register their schemas without importing `@feathers-baas/core` directly.
  - `ServiceSchemas` gains an optional `customPaths` field for per-path operation overrides — used by the files service to replace the auto-generated JSON POST with a `multipart/form-data` upload operation.
  - `configureFiles` now calls `registerServiceSchemas` (via the app) to include the files service in `/openapi.json` and `/docs`.
  - `generateOpenApiSpec` now includes hand-written entries for `POST /authManagement` (all eight actions documented with examples), `POST /authentication/refresh`, and `DELETE /authentication` (logout).

## 0.2.1

### Patch Changes

- Add README for each package, update AGENTS.md template, fix MongoDB auth entityId, and add timestamp hooks for consistent createdAt/updatedAt across all databases

## 0.2.0

### Minor Changes

- Add default FeathersBaasPlugin export so plugin discovery can validate and install plugins

## 0.1.1

### Patch Changes

- Expose ./package.json subpath in package exports to fix plugin discovery resolution

## 0.1.0

### Minor Changes

- a22281b: Initial release — File storage service with local filesystem, AWS S3, and Google Cloud Storage drivers. Streaming multipart uploads, signed URLs, and file metadata tracking.
