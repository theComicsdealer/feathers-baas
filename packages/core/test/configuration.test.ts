import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveConfig } from '../src/configuration.js'

describe('resolveConfig', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test'
    process.env['JWT_SECRET'] = 'a-secret-that-is-at-least-32-chars-long!!'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('resolves valid config', () => {
    const config = resolveConfig()
    expect(config.port).toBe(3030)
    expect(config.nodeEnv).toBe('test')
    expect(config.postgres.url).toBe('postgres://test:test@localhost:5432/test')
  })

  it('throws on missing DATABASE_URL', () => {
    delete process.env['DATABASE_URL']
    expect(() => resolveConfig()).toThrow('Invalid configuration')
  })

  it('throws on short JWT_SECRET', () => {
    process.env['JWT_SECRET'] = 'tooshort'
    expect(() => resolveConfig()).toThrow('Invalid configuration')
  })

  it('parses CORS_ORIGINS from comma-separated string', () => {
    process.env['CORS_ORIGINS'] = 'http://localhost:3000,https://app.example.com'
    const config = resolveConfig()
    expect(config.cors.origins).toEqual(['http://localhost:3000', 'https://app.example.com'])
  })

  it('enables CORS credentials by default, disabled with CORS_CREDENTIALS=false', () => {
    expect(resolveConfig().cors.credentials).toBe(true)
    process.env['CORS_CREDENTIALS'] = 'false'
    expect(resolveConfig().cors.credentials).toBe(false)
  })

  it('defaults the refresh cookie SameSite mode to auto and rejects unknown values', () => {
    expect(resolveConfig().refreshCookie.sameSite).toBe('auto')
    process.env['REFRESH_COOKIE_SAMESITE'] = 'none'
    expect(resolveConfig().refreshCookie.sameSite).toBe('none')
    process.env['REFRESH_COOKIE_SAMESITE'] = 'sometimes'
    expect(() => resolveConfig()).toThrow('Invalid configuration')
  })

  it('reads APP_URL and email link paths even without an email driver', () => {
    for (const key of ['SMTP_URL', 'RESEND_API_KEY', 'SENDGRID_API_KEY', 'BREVO_API_KEY']) delete process.env[key]
    process.env['APP_URL'] = 'https://app.example.com'
    process.env['EMAIL_VERIFY_PATH'] = '/auth/confirm'
    const { notifications } = resolveConfig()
    expect(notifications?.appUrl).toBe('https://app.example.com')
    expect(notifications?.paths.verify).toBe('/auth/confirm')
    expect(notifications?.paths.resetPassword).toBe('/reset-password')
  })

  it('leaves appUrl unset instead of defaulting to the API origin', () => {
    delete process.env['APP_URL']
    expect(resolveConfig().notifications?.appUrl).toBeUndefined()
  })

  it('parses PORT as a number', () => {
    process.env['PORT'] = '8080'
    const config = resolveConfig()
    expect(config.port).toBe(8080)
  })
})
