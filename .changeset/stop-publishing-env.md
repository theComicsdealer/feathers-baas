---
"@feathers-baas/core": patch
---

**Security:** stop publishing local files. Every earlier version of this package included the maintainer's local `packages/core/.env` (development database URL, JWT secret, admin password and an email-provider API key), because the package had no `files` allowlist. Those credentials have been rotated. The package now ships only `dist/`, `README.md` and `CHANGELOG.md`.

Nothing changes for consumers: the dropped files (`src/`, `test/`, `migrations/`, `seeds/`, `knexfile.ts`, configs) were never used at runtime.
