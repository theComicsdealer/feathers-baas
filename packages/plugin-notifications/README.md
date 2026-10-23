# @feathers-baas/plugin-notifications

Notification plugin for [feathers-baas](https://github.com/theComicsdealer/feathers-baas) — BullMQ-backed email delivery with SMTP, Resend, SendGrid, and Brevo drivers.

## Installation

```bash
pnpm add @feathers-baas/plugin-notifications
```

## How it works

Auth events (verify email, reset password, etc.) are routed through the notification system. Two delivery modes:

- **Direct mode** (no Redis) — drivers called synchronously in the request path. Suitable for development and API-based drivers.
- **Queue mode** (with Redis) — jobs enqueued in BullMQ with automatic retries and exponential backoff. Best for production.

If no driver env vars are configured, auth events are logged to console.

## Setup

Add driver env vars to `.env`:

```env
# Pick one (or more):

# SMTP
SMTP_URL=smtp://user:pass@localhost:1025
SMTP_FROM_NAME=My App
SMTP_FROM_ADDRESS=no-reply@example.com

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_NAME=My App
RESEND_FROM_ADDRESS=no-reply@yourdomain.com

# SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxx
SENDGRID_FROM_NAME=My App
SENDGRID_FROM_ADDRESS=no-reply@yourdomain.com

# Brevo
BREVO_API_KEY=xkeysib-xxxxxxxxxxxx
BREVO_FROM_NAME=My App
BREVO_FROM_ADDRESS=no-reply@yourdomain.com
```

Point email links at your **web app** (not the API):

```env
APP_URL=https://app.example.com          # default: first CORS_ORIGINS entry, with a startup warning
# EMAIL_VERIFY_PATH=/verify
# EMAIL_RESET_PASSWORD_PATH=/reset-password
# EMAIL_VERIFY_SET_PASSWORD_PATH=/verify-set-password
```

For queue mode, add Redis:

```env
REDIS_URL=redis://localhost:6379
```

No code changes needed — `@feathers-baas/core` auto-configures drivers from env vars.

The queue is named `feathers-baas-notifications` (`NOTIFICATION_QUEUE_NAME`) with BullMQ `prefix: 'feathers-baas'` (`NOTIFICATION_QUEUE_PREFIX`); the producer and the worker always use both. Versions before 0.3.0 used a name containing `:`, which bullmq ≥ 5 rejects at startup.

## Email drivers

| Driver   | Class           | Env var            | Use case                          |
|----------|-----------------|--------------------|-----------------------------------|
| SMTP     | `SMTPDriver`    | `SMTP_URL`         | Self-hosted SMTP, Mailtrap        |
| Resend   | `ResendDriver`  | `RESEND_API_KEY`   | Managed transactional email       |
| SendGrid | `SendGridDriver`| `SENDGRID_API_KEY` | Twilio SendGrid                   |
| Brevo    | `BrevoDriver`   | `BREVO_API_KEY`    | Brevo (formerly Sendinblue)       |

All configured drivers are active simultaneously.

## Auth events handled automatically

| Event              | Trigger                    |
|--------------------|----------------------------|
| Verify email       | User registers             |
| Resend verification| User requests re-send      |
| Reset password     | User requests reset        |
| Password changed   | After successful reset     |
| Email change       | Identity change request    |

## Notifier options

`createDirectNotifier` and `createBullMQNotifier` (which also takes `queue`) accept:

| Option | Default | Description |
|---|---|---|
| `registry` | *(required)* | `DriverRegistry` — core exposes its own as `app.get('notificationRegistry')` |
| `appUrl` | *(required)* | Base URL of the web app that redeems the tokens |
| `paths.verify` | `/verify` | Route for verification links |
| `paths.resetPassword` | `/reset-password` | Route for password reset links |
| `paths.verifySetPassword` | `/verify-set-password` | Route for verify-and-set-password links |
| `verifyDelay` | 5 days | Verification token lifetime in ms — used for the "expires in" copy |
| `resetDelay` | 2 hours | Reset token lifetime in ms — used for the "expires in" copy |
| `buildNotification` | `buildAuthNotification` | Replace the default email composition |

`verifyDelay` / `resetDelay` must match the `delay` / `resetDelay` given to `feathers-authentication-management`; core passes both for you.

### Customising the emails

Wrap the default builder rather than re-implementing delivery:

```ts
import { createDirectNotifier, buildAuthNotification } from '@feathers-baas/plugin-notifications'

app.set('notifier', createDirectNotifier({
  registry: app.get('notificationRegistry')!,
  appUrl: 'https://app.example.com',
  paths: { verify: '/auth/confirm' },
  buildNotification: (type, user, opts) => {
    const email = buildAuthNotification(type, user, opts)
    return email && { ...email, subject: `[My App] ${email.subject}` }
  },
}))
```

Templates receive `verifyUrl` / `resetUrl`, `expiresIn` (e.g. `"5 days"`) and `user` as EJS data.

## Exports

```ts
// Drivers
import { SMTPDriver, ResendDriver, SendGridDriver, BrevoDriver } from '@feathers-baas/plugin-notifications'

// Driver registry
import { DriverRegistry } from '@feathers-baas/plugin-notifications'

// Notifier factories and email composition
import {
  createBullMQNotifier,
  createDirectNotifier,
  buildAuthNotification,
  formatDuration,
} from '@feathers-baas/plugin-notifications'

// Queue utilities
import {
  createNotificationQueue,
  createNotificationWorker,
  enqueueNotification,
  NOTIFICATION_QUEUE_NAME,
  NOTIFICATION_QUEUE_PREFIX,
} from '@feathers-baas/plugin-notifications'
```

## Plugin interface

This package exports a `FeathersBaasPlugin` default export and is auto-discovered by `@feathers-baas/core` when listed as a dependency. Drivers are configured automatically from env vars by core's `configureNotifications()`.

## License

MIT
