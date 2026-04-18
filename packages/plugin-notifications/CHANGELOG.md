# @feathers-baas/plugin-notifications

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
