# @feathers-baas/plugin-notifications

## 0.3.0

### Minor Changes

- 4d99238: Fix BullMQ startup crash and make auth email links configurable (#6, #7).
  - The queue is now named `feathers-baas-notifications` with BullMQ `prefix: 'feathers-baas'` (exported as `NOTIFICATION_QUEUE_PREFIX`). bullmq ≥ 5 rejects `:` in queue names, so the old name crashed the app at startup whenever `REDIS_URL` and an email driver were both set. Queue and worker use the same name and prefix.
  - Notifier options accept `paths` (`verify`, `resetPassword`, `verifySetPassword`), `verifyDelay` / `resetDelay`, and a `buildNotification` override. `buildAuthNotification` and `formatDuration` are exported so apps can wrap the default emails.
  - The "link expires in…" copy is derived from the configured token lifetimes (the verification email used to say 24 hours while tokens lived 5 days).

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

- a22281b: Initial release — BullMQ-backed notification system with SMTP, Resend, SendGrid, and Brevo email drivers. Supports both queue mode (Redis) and direct synchronous delivery.
