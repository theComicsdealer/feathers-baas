# Design Decisions for `feathers-baas`

> **Source:** Distilled from [SIX-DOTS-STUDIO/feathers-saas-boilerplate](https://github.com/SIX-DOTS-STUDIO/feathers-saas-boilerplate), keeping only choices that survive the move to TypeScript + database-agnostic + CLI-generator architecture.
> **Audience:** Claude Code (implementation agent) building `feathers-baas` from scratch.
> **Read alongside:** `PRD.md`.

---

## 1. Application bootstrap order

Wire the generated app in this exact sequence — order matters because later configurators depend on earlier ones being on `app`.

1. `configuration(configurationValidator)` — config is **schema-validated at boot**. Fail fast on missing/invalid env.
2. Security & body middleware: `cors`, `json`, `urlencoded`, helmet (new — wasn't in the original), static.
3. Transports: `rest()` then realtime.
4. Database configurator — registers a connection (or pool) on `app` for services to consume lazily.
5. Authentication — registered before services so they can use `authenticate('jwt')`.
6. Services — single barrel file (`services/index.ts`) that registers all services in declaration order.
7. Channels — registered last, after all services exist.
8. Terminal middleware: `notFound`, `errorHandler({ logger })`.
9. App-wide `around.all: [logError]` hook.

---

## 2. Authentication

- **Strategies:** `jwt` + `local` (email/password) always on; OAuth strategies (Google, GitHub) opt-in via config.
- **Local strategy:** `usernameField: 'email'`, `passwordField: 'password'`.
- **Auth-management indirection:** Use `feathers-authentication-management` for verify / reset / change flows. Wrap it in a `notifier(app) => (type, user, opts) => {…}` factory — this factory is the single dispatch point that the notifications service plugs into. Do **not** hardcode email sending inside auth-management.
- All verification / reset URLs read from config, never hardcoded.

---

## 3. Users service

### 3.1 Schema (TypeBox)
Required fields, baseline:
- `id`, `email`, `password` (write-only)
- `googleId?` (or generic `oauthIds: { provider: id }` map — preferred for multi-provider)
- `isVerified: boolean`, `isActive: boolean`
- `roles: string[]` — **role names, not IDs.** Denormalized on purpose: agent-friendly, no join needed for permission checks.
- `createdAt`, `updatedAt`, `deletedAt?` — ISO strings, not epoch numbers (the original used numeric; ISO is more portable across SQL/Mongo and easier to read in logs).
- Verification flow fields managed by `feathers-authentication-management`: `verifyToken`, `verifyShortToken`, `verifyExpires`, `verifyChanges`.

### 3.2 Resolvers
- **External resolver strips `password`** on every outbound response.
- **Data resolver hashes password** via `passwordHash({ strategy: 'local' })` on create.
- **Patch resolver re-hashes password only if the patch includes a `password` field** (the original re-hashed unconditionally — bug).
- **Query resolver does NOT blanket-scope `id` to the authenticated user.** Self-scoping is a per-route concern handled by permissions, not a global query rewrite. (Original repo bug — fixed here.)

### 3.3 Create hook chain (preserve this order)
```
before.create:
  addVerification('auth-management')
  setDefaultRoleIfNotProvided()         → ['user'] if empty
  iff(isProvider('rest'), preventAdminRegistration())
  checkIfItemIsUnique(app, 'email')
  validateData
  resolveData
after.create:
  sendVerify()
after.all:
  removeVerification()
```

Rationale for the order: defaults before guards, guards before uniqueness, uniqueness before validation (cheap rejects first), validation before resolution.

### 3.4 Soft delete
- Standard pattern across all services that opt in.
- Custom soft-delete query: `{ isDeleted: { $ne: true } }` for Mongo, `{ isDeleted: false }` for SQL.
- Provide a single `softDeletable()` helper that wires `find` / `get` / `patch` filters and turns `remove` into a soft delete via the patch resolver.

---

## 4. Roles & permissions

### 4.1 Model
A role is `{ name: string, permissions: Permission[] }`. A permission is:
```ts
type Permission = {
  service: string                                                      // e.g. 'users'
  methods: ('*' | 'find' | 'get' | 'create' | 'update' | 'patch' | 'remove')[]
}
```

**This is the single most important design decision to preserve.** It's the right granularity for a Feathers-native, agent-friendly RBAC: an LLM that knows the service map already knows the permission space. Resist any push to adopt Casbin, RLS-style policies, or resource-action verbs in v1.

- Wildcard `'*'` for "all methods" on a service.
- Roles referenced from `user.roles` by **name**, not ID.
- Pre-seed three roles at init: `admin` (`*` on everything), `user`, `guest`.

### 4.2 Permission check hook
Runs as a `before.all` hook on protected services, gated by `iff(isProvider('rest'), checkPermissions(app))` — internal calls always bypass (the CLI relies on this to seed admins).

Algorithm:
1. Fetch roles where `name $in user.roles`.
2. Flatten permissions across roles.
3. Find permissions where `service === context.path`.
4. Allow if any matched permission's methods contain `context.method` or `'*'`.
5. Otherwise throw **`Forbidden`** (the original threw `MethodNotAllowed` — wrong class, fix on rewrite).

**Add caching:** in-memory LRU keyed by the sorted set of role names on the user, invalidated on any `roles` service create/patch/remove. The original fires a DB query per request — unacceptable at scale.

### 4.3 Roles service hook chain
- `authenticate('jwt')` on all methods.
- `checkPermissions` gated by `iff(isProvider('rest'))` — bootstrap admin via CLI internal calls bypasses this.

---

## 5. Notifications: dispatcher pattern

Preserve the `notifier(app) => (type, user, opts) => {…}` factory shape from auth-management — but **replace the inline `if (type === ...)` branching with a registry**:

```ts
type NotificationEvent = string                                        // e.g. 'auth.verify-signup'
type Registry = Record<NotificationEvent, ChannelDriver[]>
```

Resolution order per event:
1. Look up event → list of channel drivers.
2. Filter by user's notification preferences (`notification_preferences` table per PRD §7.5).
3. Enqueue one BullMQ job per (driver, user) pair.
4. Driver renders template + sends; failures retry with exponential backoff.

Drivers implement a uniform interface: `send(payload, recipient) => Promise<SendResult>`. Channels in v1: `email` (SMTP, Resend, SendGrid), `sms` (Twilio), `push` (FCM, APNs), `webhook`.

---

## 6. Files: keep the schema shape, rebuild the rest

The original files service is ~10% complete, but its schema anticipated the right thing. Keep these fields:
- `filename`, `mimetype`, `size`, `extension`
- `visibility: 'private' | 'public'`
- `bucket`, `folder`
- `publicUrl` (for `visibility: 'public'`)
- Add: `ownerId`, `driver` (`'local' | 's3' | 'gcs'`), `signedUrlExpiresAt?`

Everything else (driver interface, signed URLs, ownership enforcement, MIME/size validation) is greenfield per PRD §7.4.

---

## 7. Cross-cutting hooks worth porting

| Hook | Purpose | Notes |
|---|---|---|
| `logError` | App-wide error logging | Mounted in `around.all` globally |
| `setNow` | Resolver returning current timestamp | Used for `createdAt` / `updatedAt` |
| `checkIfItemIsUnique(app, field)` | Pre-create uniqueness guard | Must use `_find` (underscored) to bypass hooks during the check; throws `BadRequest` |
| `setDefaultRoleIfNotProvided` | Defaults `data.roles = ['user']` on create | |
| `preventAdminRegistration` | Throws `Forbidden` if `'admin' ∈ data.roles` | Gated by `iff(isProvider('rest'))` on create; **applied unconditionally on patch** to prevent privilege escalation |
| `preventEmptyRolesOnPatch` | Throws `BadRequest` if patch wipes roles | |
| `sendVerify` | Calls `notifier('auth.verify-signup', user)` after user create | |

---

## 8. CLI architecture

### 8.1 Per-command structure
Keep the actions/questions split — it scales cleanly:
```
cli/
  index.ts                          # commander entry
  actions/
    add-admin-action.ts             # executor
    add-role-action.ts
  questions/
    add-role-questions.ts           # inquirer prompt arrays
    add-more-permissions-questions.ts
```

### 8.2 Command naming
**`verb:noun`** (`admin:add`, `role:add`, `db:migrate`, `auth:issue-token`). Clear, scriptable, scales.

### 8.3 CLI shares the running app's services
CLI commands import the app and call services with internal calls (no auth, bypass REST-gated guards). No duplicate models, no custom DB code in CLI. This is what makes `admin:add` able to create the bootstrap admin despite `preventAdminRegistration` being active for REST.

### 8.4 Required additions for `feathers-baas` (not in original)
- **Every command must support both interactive (inquirer) and flag-based modes** for CI/scripting use.
- **Every command must support `--json` output** for agent consumption.
- **No `process.exit(0)` at the end of `main()`** — let the runtime exit naturally so long-running commands compose.

---

## 9. Things explicitly NOT carried over

The original made these choices, all reversed for `feathers-baas`:

- ❌ JavaScript → ✅ TypeScript (strict)
- ❌ Express → ✅ Koa (Feathers v5 default)
- ❌ MongoDB-only, services extend `MongoDBService` directly → ✅ Database-agnostic via Feathers' adapter ecosystem
- ❌ JSON Schema strings → ✅ TypeBox (single source for validation + types + OpenAPI)
- ❌ Winston → ✅ pino (structured, fast)
- ❌ No migrations → ✅ Knex migrations (SQL) + lightweight `_migrations` runner (Mongo)
- ❌ Synchronous email sending inline with the request → ✅ BullMQ-queued with retry
- ❌ Hardcoded localhost URLs in notifier → ✅ Config-driven
- ❌ `app.publish(() => app.channel('authenticated'))` (every authenticated user gets every event) → ✅ Per-service explicit publishers; default is publish-to-nothing
- ❌ No rate limiting, no helmet → ✅ Both on by default
- ❌ No health checks, no OpenAPI, no Docker → ✅ All shipped in scaffold (per PRD §11)
- ❌ Inquirer-only CLI → ✅ Inquirer + flags + `--json`
