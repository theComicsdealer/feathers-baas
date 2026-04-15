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

  it('parses PORT as a number', () => {
    process.env['PORT'] = '8080'
    const config = resolveConfig()
    expect(config.port).toBe(8080)
  })
})
