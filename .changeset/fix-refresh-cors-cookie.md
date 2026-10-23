---
"@feathers-baas/core": minor
---

Make the refresh-token flow work end to end (#2, #3, #4, #5, #6).

- `POST /authentication/refresh` is now an `authentication/refresh` service, so it is actually reached (the Koa middleware was registered after `rest()` and never ran). It answers **201** like `POST /authentication`.
- Refresh responses — and the JWT strategy's cookie-based refresh — no longer leak `verifyToken`, `resetToken` and the other auth-management fields. New export: `sanitizeUser` / `VERIFICATION_FIELDS` for any internal user read returned to a client.
- The refresh cookie is now actually set and read over REST (`params.cookies`; `params.connection` was never populated). Its `SameSite` is chosen per login: `None; Secure` for cross-site requests, `Lax` otherwise (`REFRESH_COOKIE_SAMESITE` to override). New `TRUST_PROXY` for Secure cookies behind a TLS proxy; a cookie that cannot be set no longer fails the login.
- CORS sends `Access-Control-Allow-Credentials: true` (`CORS_CREDENTIALS=false` to disable) and no longer echoes the first allowlisted origin for unknown origins.
- `APP_URL` (the **web app** URL for email links) is read even without an email driver; when unset it falls back to the first CORS origin with a startup warning instead of the API's own origin. New `EMAIL_VERIFY_PATH`, `EMAIL_RESET_PASSWORD_PATH`, `EMAIL_VERIFY_SET_PASSWORD_PATH`. The configured driver registry is available as `app.get('notificationRegistry')`.
