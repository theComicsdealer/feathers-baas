// Regression tests for GHSA-h2x2-x7xj-4cr3 — the local strategy must reject wrong passwords.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { feathers, type Params, type Query } from '@feathersjs/feathers'
import { koa, rest, bodyParser, errorHandler } from '@feathersjs/koa'
import { AuthenticationService } from '@feathersjs/authentication'
import * as argon2 from 'argon2'
import { ArgonLocalStrategy } from '../src/auth/strategies/local.strategy.js'

const EMAIL = 'alice@example.com'
const PASSWORD = 'correct-horse-battery-staple'

type Row = Record<string, unknown>

// Mimics the stock users service: `find` strips `password` and filters soft-deleted
// rows for every caller (internal included); `_find` is the raw, hook-free adapter call.
class FakeUsers {
  constructor(private rows: Row[]) {}

  private strip({ password: _password, ...rest }: Row): Row {
    return rest
  }

  async _find({ query = {} }: { query?: Query } = {}): Promise<Row[]> {
    const { $limit, ...where } = query
    const matches = this.rows.filter((row) =>
      Object.entries(where).every(([k, v]) => (v === null ? row[k] == null : row[k] === v)),
    )
    return typeof $limit === 'number' ? matches.slice(0, $limit) : matches
  }

  async find(params: Params = {}): Promise<Row[]> {
    const rows = await this._find({ query: { ...params.query, deletedAt: null } })
    return rows.map((row) => this.strip(row))
  }

  async get(id: unknown): Promise<Row> {
    const row = this.rows.find((r) => r['id'] === id)
    if (!row) throw new Error(`No user ${String(id)}`)
    return this.strip(row)
  }
}

let app: ReturnType<typeof koa>
let server: Server
let baseUrl: string

async function login(email: string, password: string): Promise<Response> {
  return fetch(`${baseUrl}/authentication`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy: 'local', email, password }),
  })
}

beforeAll(async () => {
  const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id, memoryCost: 1024, timeCost: 2, parallelism: 1 })

  app = koa(feathers())
  app.use(errorHandler())
  app.use(bodyParser())
  app.configure(rest())

  app.use(
    'users',
    new FakeUsers([
      { id: 1, email: EMAIL, password: hash, deletedAt: null },
      { id: 2, email: 'nohash@example.com', password: null, deletedAt: null },
      { id: 3, email: 'deleted@example.com', password: hash, deletedAt: new Date() },
    ]),
    { methods: ['find', 'get'] },
  )

  app.set('authentication', {
    secret: 'a-secret-that-is-at-least-32-chars-long!!',
    entity: 'user',
    entityId: 'id',
    service: 'users',
    authStrategies: ['local'],
    local: { usernameField: 'email', passwordField: 'password' },
  })
  const authService = new AuthenticationService(app)
  authService.register('local', new ArgonLocalStrategy())
  app.use('authentication', authService)

  server = await app.listen(0)
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((resolve) => server?.close(resolve))
})

describe('ArgonLocalStrategy', () => {
  it('rejects a wrong password with 401', async () => {
    const res = await login(EMAIL, 'wrong-password')
    expect(res.status).toBe(401)
  })

  it('rejects a user with no password hash with 401', async () => {
    const res = await login('nohash@example.com', 'anything')
    expect(res.status).toBe(401)
  })

  it('rejects an unknown user with 401', async () => {
    const res = await login('nobody@example.com', PASSWORD)
    expect(res.status).toBe(401)
  })

  it('rejects a soft-deleted user with 401', async () => {
    const res = await login('deleted@example.com', PASSWORD)
    expect(res.status).toBe(401)
  })

  it('accepts the correct password and does not leak the hash', async () => {
    const res = await login(EMAIL, PASSWORD)
    expect(res.status).toBe(201)
    const body = (await res.json()) as { accessToken?: string; user?: Row }
    expect(body.accessToken).toBeTypeOf('string')
    expect(body.user?.['email']).toBe(EMAIL)
    expect(body.user).not.toHaveProperty('password')
  })

  it('rejects a wrong password on internal calls', async () => {
    await expect(
      app.service('authentication').create({ strategy: 'local', email: EMAIL, password: 'wrong-password' }),
    ).rejects.toMatchObject({ code: 401 })
  })

  it('does not return the hash on internal calls', async () => {
    const result = await app.service('authentication').create({ strategy: 'local', email: EMAIL, password: PASSWORD })
    expect(result.user).toMatchObject({ email: EMAIL })
    expect(result.user).not.toHaveProperty('password')
  })
})
