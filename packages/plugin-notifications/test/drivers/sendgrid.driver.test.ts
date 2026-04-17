import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock @sendgrid/mail ──────────────────────────────────────────────────────

const { mockSend, mockSetApiKey } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockSetApiKey: vi.fn(),
}))

vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: mockSetApiKey,
    send: mockSend,
  },
}))

// ─── Imports after mocking ────────────────────────────────────────────────────

import { SendGridDriver } from '../../src/drivers/sendgrid.driver.js'
import type { Notification } from '../../src/types.js'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SendGridDriver', () => {
  let driver: SendGridDriver

  beforeEach(() => {
    mockSend.mockReset()
    mockSetApiKey.mockReset()
    mockSend.mockResolvedValue([{ statusCode: 202 }, {}])
    driver = new SendGridDriver({
      apiKey: 'SG.test_key',
      fromName: 'Feathers BaaS',
      fromAddress: 'no-reply@example.com',
    })
  })

  it('has the correct driver name', () => {
    expect(driver.name).toBe('sendgrid')
  })

  it('sets the API key on construction', () => {
    expect(mockSetApiKey).toHaveBeenCalledWith('SG.test_key')
  })

  describe('send', () => {
    it('calls sgMail.send with rendered HTML and correct fields', async () => {
      const notification: Notification = {
        to: 'recipient@example.com',
        channel: 'email',
        subject: 'Welcome!',
        bodyTemplate: '<h1>Hello, <%= name %></h1>',
        data: { name: 'Alice' },
      }

      await driver.send(notification)

      expect(mockSend).toHaveBeenCalledOnce()
      const arg = mockSend.mock.calls[0]?.[0] as Record<string, unknown>
      expect(arg['to']).toBe('recipient@example.com')
      expect(arg['from']).toEqual({ name: 'Feathers BaaS', email: 'no-reply@example.com' })
      expect(arg['subject']).toBe('Welcome!')
      expect(arg['html']).toBe('<h1>Hello, Alice</h1>')
    })

    it('includes text when textTemplate is provided', async () => {
      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: '<p><%= msg %></p>',
        textTemplate: 'Plain: <%= msg %>',
        data: { msg: 'test' },
      }

      await driver.send(notification)

      const arg = mockSend.mock.calls[0]?.[0] as Record<string, unknown>
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

      const arg = mockSend.mock.calls[0]?.[0] as Record<string, unknown>
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

      const arg = mockSend.mock.calls[0]?.[0] as Record<string, unknown>
      expect(arg['subject']).toBe('(no subject)')
    })
  })
})
