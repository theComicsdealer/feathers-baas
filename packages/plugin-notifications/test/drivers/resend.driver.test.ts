import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock resend SDK ──────────────────────────────────────────────────────────

const mockEmailsSend = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend },
  })),
}))

// ─── Imports after mocking ────────────────────────────────────────────────────

import { ResendDriver } from '../../src/drivers/resend.driver.js'
import type { Notification } from '../../src/types.js'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ResendDriver', () => {
  let driver: ResendDriver

  beforeEach(() => {
    mockEmailsSend.mockReset()
    mockEmailsSend.mockResolvedValue({ data: { id: 'msg-abc' }, error: null })
    driver = new ResendDriver({
      apiKey: 're_test_key',
      fromName: 'Feathers BaaS',
      fromAddress: 'no-reply@example.com',
    })
  })

  it('has the correct driver name', () => {
    expect(driver.name).toBe('resend')
  })

  describe('send', () => {
    it('calls emails.send with rendered HTML and correct fields', async () => {
      const notification: Notification = {
        to: 'recipient@example.com',
        channel: 'email',
        subject: 'Welcome!',
        bodyTemplate: '<h1>Hello, <%= name %></h1>',
        data: { name: 'Alice' },
      }

      await driver.send(notification)

      expect(mockEmailsSend).toHaveBeenCalledOnce()
      const arg = mockEmailsSend.mock.calls[0]?.[0] as Record<string, unknown>
      expect(arg['to']).toEqual(['recipient@example.com'])
      expect(arg['from']).toBe('Feathers BaaS <no-reply@example.com>')
      expect(arg['subject']).toBe('Welcome!')
      expect(arg['html']).toBe('<h1>Hello, Alice</h1>')
    })

    it('renders the text template when provided', async () => {
      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: '<p><%= msg %></p>',
        textTemplate: 'Plain: <%= msg %>',
        data: { msg: 'test' },
      }

      await driver.send(notification)

      const arg = mockEmailsSend.mock.calls[0]?.[0] as Record<string, unknown>
      expect(arg['text']).toBe('Plain: test')
    })

    it('omits text when no textTemplate is given', async () => {
      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: '<p>HTML only</p>',
        data: {},
      }

      await driver.send(notification)

      const arg = mockEmailsSend.mock.calls[0]?.[0] as Record<string, unknown>
      expect(arg['text']).toBeUndefined()
    })

    it('falls back to "(no subject)" when subject is not provided', async () => {
      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: 'body',
        data: {},
      }

      await driver.send(notification)

      const arg = mockEmailsSend.mock.calls[0]?.[0] as Record<string, unknown>
      expect(arg['subject']).toBe('(no subject)')
    })

    it('throws when the Resend API returns an error', async () => {
      mockEmailsSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid API key', name: 'validation_error' },
      })

      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: 'body',
        data: {},
      }

      await expect(driver.send(notification)).rejects.toThrow(/Invalid API key/)
    })
  })
})
