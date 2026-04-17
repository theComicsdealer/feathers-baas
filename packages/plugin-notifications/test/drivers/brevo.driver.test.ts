import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock @getbrevo/brevo ─────────────────────────────────────────────────────

const mockSendTransacEmail = vi.fn()

vi.mock('@getbrevo/brevo', () => {
  return {
    TransactionalEmailsApiApiKeys: { apiKey: 0, partnerKey: 1 },
    TransactionalEmailsApi: vi.fn().mockImplementation(() => ({
      setApiKey: vi.fn(),
      sendTransacEmail: mockSendTransacEmail,
    })),
    SendSmtpEmail: vi.fn().mockImplementation(() => ({})),
  }
})

// ─── Imports after mocking ────────────────────────────────────────────────────

import { BrevoDriver } from '../../src/drivers/brevo.driver.js'
import type { Notification } from '../../src/types.js'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BrevoDriver', () => {
  let driver: BrevoDriver

  beforeEach(() => {
    mockSendTransacEmail.mockReset()
    mockSendTransacEmail.mockResolvedValue({ messageId: '<msg-abc@smtp-relay.sendinblue.com>' })
    driver = new BrevoDriver({
      apiKey: 'xkeysib-test',
      fromName: 'Feathers BaaS',
      fromAddress: 'no-reply@example.com',
    })
  })

  it('has the correct driver name', () => {
    expect(driver.name).toBe('brevo')
  })

  describe('send', () => {
    it('calls sendTransacEmail once per notification', async () => {
      const notification: Notification = {
        to: 'recipient@example.com',
        channel: 'email',
        subject: 'Welcome!',
        bodyTemplate: '<h1>Hello, <%= name %></h1>',
        data: { name: 'Alice' },
      }

      await driver.send(notification)

      expect(mockSendTransacEmail).toHaveBeenCalledOnce()
    })

    it('sets htmlContent with rendered EJS', async () => {
      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: '<p>Hello, <%= user %>!</p>',
        data: { user: 'Bob' },
      }

      await driver.send(notification)

      // The email object is mutated in-place by the driver before calling send
      const emailArg = mockSendTransacEmail.mock.calls[0]?.[0] as Record<string, unknown>
      expect(emailArg['htmlContent']).toBe('<p>Hello, Bob!</p>')
    })

    it('sets textContent when textTemplate is provided', async () => {
      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: '<p><%= msg %></p>',
        textTemplate: 'Plain: <%= msg %>',
        data: { msg: 'hi' },
      }

      await driver.send(notification)

      const emailArg = mockSendTransacEmail.mock.calls[0]?.[0] as Record<string, unknown>
      expect(emailArg['textContent']).toBe('Plain: hi')
    })

    it('does not set textContent when no textTemplate is given', async () => {
      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: '<p>HTML only</p>',
        data: {},
      }

      await driver.send(notification)

      const emailArg = mockSendTransacEmail.mock.calls[0]?.[0] as Record<string, unknown>
      expect(emailArg['textContent']).toBeUndefined()
    })

    it('falls back to "(no subject)" when subject is not provided', async () => {
      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: 'body',
        data: {},
      }

      await driver.send(notification)

      const emailArg = mockSendTransacEmail.mock.calls[0]?.[0] as Record<string, unknown>
      expect(emailArg['subject']).toBe('(no subject)')
    })
  })
})
