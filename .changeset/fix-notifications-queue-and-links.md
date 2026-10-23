---
"@feathers-baas/plugin-notifications": minor
---

Fix BullMQ startup crash and make auth email links configurable (#6, #7).

- The queue is now named `feathers-baas-notifications` with BullMQ `prefix: 'feathers-baas'` (exported as `NOTIFICATION_QUEUE_PREFIX`). bullmq ≥ 5 rejects `:` in queue names, so the old name crashed the app at startup whenever `REDIS_URL` and an email driver were both set. Queue and worker use the same name and prefix.
- Notifier options accept `paths` (`verify`, `resetPassword`, `verifySetPassword`), `verifyDelay` / `resetDelay`, and a `buildNotification` override. `buildAuthNotification` and `formatDuration` are exported so apps can wrap the default emails.
- The "link expires in…" copy is derived from the configured token lifetimes (the verification email used to say 24 hours while tokens lived 5 days).
