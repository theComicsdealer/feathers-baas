// HTTP-level regression tests for the refresh flow, CORS and the refresh cookie (issues #2–#5).
// Runs the real createApp; only the database and the DB-backed services are faked.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import * as argon2 from 'argon2'
import type { Application } from '../src/declarations.js'

type Row = Record<string, unknown>

// No database: createApp's DB step becomes a no-op.
vi.mock('../src/db/index.js', () => ({
  configureKnex: async () => {},
  configureMysql: async () => {},
  configureSqlite: async () => {},
  configureMongo: async () => {},
}))

// Like an internal users.get(): password stripped, verification fields NOT stripped
// (feathers-authentication-management's removeVerification no-ops without a provider).
vi.mock('../src/services/index.js', () => ({
  configureServices(app: Application) {
    const rows: Row[] = (globalThis as { __users?: Row[] }).__users ?? []
    const strip = ({ password: _password, ...rest }: Row): Row => rest
    const service = {
      async _find({ query = {} }: { query?: Row } = {}) {
        const { $limit: _limit, ...where } = query
        return rows.filter((r) => Object.entries(where).every(([k, v]) => (v === null ? r[k] == null : r[k] === v)))
      },
      async find(params: { query?: Row } = {}) {
        return (await service._find(params)).map(strip)
      },
      async get(id: unknown) {
        const row = rows.find((r) => String(r['id']) === String(id))
        if (!row) throw new Error('not found')
        return strip(row)
      },
      async patch(id: unknown, data: Row) {
        const row = rows.find((r) => String(r['id']) === String(id))!
        Object.assign(row, data)
        return strip(row)
      },
    }
    ;(app as unknown as { use(path: string, svc: unknown, opts: unknown): void }).use('users', service, {
      methods: ['find', 'get'],
      events: [],
    })
  },
}))

const ORIGIN = 'https://app.example.com'
const EMAIL = 'alice@example.com'
const PASSWORD = 'correct-horse-battery-staple'

let app: Application
let server: Server
let baseUrl: string

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function login(headers: Record<string, string> = {}) {
  return post('/authentication', { strategy: 'local', email: EMAIL, password: PASSWORD }, headers)
}

function refreshCookie(res: Response): string | undefined {
  return res.headers.getSetCookie().find((c) => c.startsWith('feathers-refresh='))
}

beforeAll(async () => {
  for (const key of ['MYSQL_URL', 'SQLITE_FILENAME', 'MONGODB_URL', 'REDIS_URL', 'SMTP_URL', 'RESEND_API_KEY', 'SENDGRID_API_KEY', 'BREVO_API_KEY', 'REFRESH_COOKIE_SAMESITE', 'CORS_CREDENTIALS']) {
    delete process.env[key]
  }
  process.env['DATABASE_URL'] = 'postgres://mocked:mocked@127.0.0.1:1/mocked' // never connected — db is mocked
  process.env['JWT_SECRET'] = 'a-secret-that-is-at-least-32-chars-long!!'
  process.env['CORS_ORIGINS'] = `${ORIGIN},http://localhost:3000`
  process.env['TRUST_PROXY'] = 'true'

  const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id, memoryCost: 1024, timeCost: 2, parallelism: 1 })
  ;(globalThis as { __users?: Row[] }).__users = [
    {
      id: 'u1',
      email: EMAIL,
      password: hash,
      roles: ['user'],
      deletedAt: null,
      verifyToken: 'secret-verify-token',
      verifyShortToken: '123456',
      verifyExpires: new Date(),
      verifyChanges: {},
      resetToken: 'secret-reset-token',
      resetShortToken: '654321',
      resetExpires: new Date(),
    },
  ]

  const { createApp } = await import('../src/app.js')
  app = await createApp()
  server = await app.listen(0)
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((resolve) => server?.close(resolve))
})

const LEAKY_FIELDS = ['password', 'verifyToken', 'verifyShortToken', 'verifyExpires', 'verifyChanges', 'resetToken', 'resetShortToken', 'resetExpires']

describe('POST /authentication/refresh (#2, #5)', () => {
  it('is reached: a missing refreshToken is a 400 from the refresh handler', async () => {
    const res = await post('/authentication/refresh', {})
    expect(res.status).toBe(400)
    expect(((await res.json()) as { message: string }).message).toBe('refreshToken is required')
  })

  it('returns 201 with a new access token and a sanitised user', async () => {
    const { refreshToken } = (await (await login()).json()) as { refreshToken: string }

    const res = await post('/authentication/refresh', { refreshToken })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { accessToken: string; user: Row }
    expect(body.accessToken).toBeTypeOf('string')
    expect(body.user['email']).toBe(EMAIL)
    for (const field of LEAKY_FIELDS) expect(body.user).not.toHaveProperty(field)
  })

  it('rejects an access token with 401', async () => {
    const { accessToken } = (await (await login()).json()) as { accessToken: string }
    const res = await post('/authentication/refresh', { refreshToken: accessToken })
    expect(res.status).toBe(401)
  })

  it('does not shadow DELETE /authentication (logout)', async () => {
    const { accessToken } = (await (await login()).json()) as { accessToken: string }
    const res = await fetch(`${baseUrl}/authentication`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.status).toBe(200)
  })
})

describe('JWT strategy cookie refresh (#5)', () => {
  it('returns a sanitised user when an expired access token is refreshed from the cookie', async () => {
    const { refreshToken } = (await (await login()).json()) as { refreshToken: string }
    const expired = await app.service('authentication').createAccessToken({ sub: 'u1' }, { expiresIn: -10 })

    const res = await post(
      '/authentication',
      { strategy: 'jwt', accessToken: expired },
      { Cookie: `feathers-refresh=${refreshToken}` },
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { user: Row }
    expect(body.user['email']).toBe(EMAIL)
    for (const field of LEAKY_FIELDS) expect(body.user).not.toHaveProperty(field)
  })
})

describe('CORS (#3)', () => {
  it('allows credentials for an allowlisted origin', async () => {
    const res = await fetch(`${baseUrl}/authentication`, {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(res.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('sends no CORS headers for other origins', async () => {
    const res = await fetch(`${baseUrl}/authentication`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(res.headers.get('access-control-allow-credentials')).toBeNull()
  })
})

describe('refresh cookie (#4)', () => {
  it('is set on login, HttpOnly and SameSite=Lax for same-site requests', async () => {
    const res = await login({ 'Sec-Fetch-Site': 'same-site' })
    expect(res.status).toBe(201)
    const cookie = refreshCookie(res)
    expect(cookie).toBeDefined()
    expect(cookie).toMatch(/path=\/authentication/i)
    expect(cookie).toMatch(/httponly/i)
    expect(cookie).toMatch(/samesite=lax/i)
  })

  it('is SameSite=None; Secure for cross-site requests over HTTPS', async () => {
    const res = await login({ 'Sec-Fetch-Site': 'cross-site', Origin: ORIGIN, 'X-Forwarded-Proto': 'https' })
    expect(res.status).toBe(201)
    const cookie = refreshCookie(res)
    expect(cookie).toMatch(/samesite=none/i)
    expect(cookie).toMatch(/secure/i)
  })

  it('still logs in when a Secure cookie cannot be set over plain HTTP', async () => {
    const res = await login({ 'Sec-Fetch-Site': 'cross-site', Origin: ORIGIN })
    expect(res.status).toBe(201)
    expect(refreshCookie(res)).toBeUndefined()
  })
})
