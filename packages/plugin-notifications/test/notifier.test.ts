import { describe, it, expect, vi } from 'vitest'
import { buildAuthNotification, createDirectNotifier, formatDuration } from '../src/notifier.js'
import { DriverRegistry } from '../src/registry.js'
import type { Notification, NotifierDriver } from '../src/types.js'

const user = { email: 'alice@example.com', verifyToken: 'v/tok', resetToken: 'r-tok' }

describe('formatDuration', () => {
  it('formats whole units', () => {
    expect(formatDuration(1000 * 60 * 60 * 24 * 5)).toBe('5 days')
    expect(formatDuration(1000 * 60 * 60 * 2)).toBe('2 hours')
    expect(formatDuration(1000 * 60 * 60)).toBe('1 hour')
    expect(formatDuration(1000 * 60 * 90)).toBe('90 minutes')
  })
})

describe('buildAuthNotification', () => {
  it('uses the default paths and auth-management default lifetimes', () => {
    const verify = buildAuthNotification('auth.resend-verify-signup', user, { appUrl: 'https://app.example.com/' })
    expect(verify?.data?.['verifyUrl']).toBe('https://app.example.com/verify?token=v%2Ftok')
    expect(verify?.data?.['expiresIn']).toBe('5 days')

    const reset = buildAuthNotification('auth.send-reset-pwd', user, { appUrl: 'https://app.example.com' })
    expect(reset?.data?.['resetUrl']).toBe('https://app.example.com/reset-password?token=r-tok')
    expect(reset?.data?.['expiresIn']).toBe('2 hours')
  })

  it('honours custom paths and delays', () => {
    const opts = {
      appUrl: 'https://app.example.com',
      paths: { verify: '/auth/confirm', resetPassword: 'auth/reset' },
      verifyDelay: 1000 * 60 * 60 * 24,
      resetDelay: 1000 * 60 * 30,
    }
    const verify = buildAuthNotification('auth.verify-signup', user, opts)
    expect(verify?.data?.['verifyUrl']).toBe('https://app.example.com/auth/confirm?token=v%2Ftok')
    expect(verify?.data?.['expiresIn']).toBe('1 day')

    const reset = buildAuthNotification('auth.send-reset-pwd', user, opts)
    expect(reset?.data?.['resetUrl']).toBe('https://app.example.com/auth/reset?token=r-tok')
    expect(reset?.data?.['expiresIn']).toBe('30 minutes')
  })
})

describe('createDirectNotifier', () => {
  function setup() {
    const send = vi.fn<(n: Notification) => Promise<void>>().mockResolvedValue(undefined)
    const driver: NotifierDriver = { name: 'fake', send }
    const registry = new DriverRegistry()
    registry.registerDriver(driver)
    registry.mapEvent('auth.resend-verify-signup', 'fake')
    return { registry, send }
  }

  it('passes path options through to the email', async () => {
    const { registry, send } = setup()
    const notify = createDirectNotifier({ registry, appUrl: 'https://app.example.com', paths: { verify: '/confirm' } })
    await notify('resendVerifySignup', user, {})
    expect(send.mock.calls[0]![0].data?.['verifyUrl']).toBe('https://app.example.com/confirm?token=v%2Ftok')
  })

  it('lets apps override composition with buildNotification', async () => {
    const { registry, send } = setup()
    const notify = createDirectNotifier({
      registry,
      appUrl: 'https://app.example.com',
      buildNotification: (type, u, opts) => {
        const base = buildAuthNotification(type, u, opts)
        return base && { ...base, subject: 'Custom subject' }
      },
    })
    await notify('resendVerifySignup', user, {})
    expect(send.mock.calls[0]![0].subject).toBe('Custom subject')
  })
})
