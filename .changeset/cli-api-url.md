---
"feathers-baas": patch
---

Generated projects use `API_URL` (not `APP_URL`) as the base URL for local file links, since `APP_URL` is the web app's URL used in auth emails. Document `API_URL`, `TRUST_PROXY` and the email link path variables in `.env.example`.
