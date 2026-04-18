# @feathers-baas/plugin-notifications

Notification plugin for [feathers-baas](https://github.com/anthropics/feathers-baas) — BullMQ-backed email delivery with SMTP, Resend, SendGrid, and Brevo drivers.

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

For queue mode, add Redis:

```env
REDIS_URL=redis://localhost:6379
```

No code changes needed — `@feathers-baas/core` auto-configures drivers from env vars.

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

## Exports

```ts
// Drivers
import { SMTPDriver, ResendDriver, SendGridDriver, BrevoDriver } from '@feathers-baas/plugin-notifications'

// Driver registry
import { DriverRegistry } from '@feathers-baas/plugin-notifications'

// Notifier factories
import { createBullMQNotifier, createDirectNotifier } from '@feathers-baas/plugin-notifications'

// Queue utilities
import { createNotificationQueue, createNotificationWorker } from '@feathers-baas/plugin-notifications'
```

## Plugin interface

This package exports a `FeathersBaasPlugin` default export and is auto-discovered by `@feathers-baas/core` when listed as a dependency. Drivers are configured automatically from env vars by core's `configureNotifications()`.

## License

MIT
