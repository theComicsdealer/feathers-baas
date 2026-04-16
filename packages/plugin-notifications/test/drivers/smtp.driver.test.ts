import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoist mock variables so they're available inside vi.mock factories ───────
const { mockSendMail, mockVerify, mockClose } = vi.hoisted(() => ({
  mockSendMail: vi.fn(),
  mockVerify: vi.fn(),
  mockClose: vi.fn(),
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify,
      close: mockClose,
    }),
  },
}))

// ─── Imports after mocking ────────────────────────────────────────────────────
import { SMTPDriver } from '../../src/drivers/smtp.driver.js'
import type { Notification } from '../../src/types.js'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SMTPDriver', () => {
  let driver: SMTPDriver

  beforeEach(() => {
    mockSendMail.mockReset()
    mockSendMail.mockResolvedValue({ messageId: 'msg-123' })
    driver = new SMTPDriver({
      url: 'smtp://user:pass@localhost:1025',
      fromName: 'Feathers BaaS',
      fromAddress: 'no-reply@example.com',
    })
  })

  it('has the correct driver name', () => {
    expect(driver.name).toBe('smtp')
  })

  describe('send', () => {
    it('calls sendMail with rendered HTML', async () => {
      const notification: Notification = {
        to: 'recipient@example.com',
        channel: 'email',
        subject: 'Welcome, <%= name %>!',
        bodyTemplate: '<h1>Hello, <%= name %></h1>',
        data: { name: 'Alice' },
      }

      await driver.send(notification)

      expect(mockSendMail).toHaveBeenCalledOnce()
      const mailArg = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>
      expect(mailArg['to']).toBe('recipient@example.com')
      // subject is passed as-is (not EJS-rendered)
      expect(mailArg['subject']).toBe('Welcome, <%= name %>!')
      // HTML body should have EJS rendered
      expect(mailArg['html']).toBe('<h1>Hello, Alice</h1>')
    })

    it('renders the text template when provided', async () => {
      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: '<p><%= msg %></p>',
        textTemplate: 'Plain: <%= msg %>',
        data: { msg: 'test message' },
      }

      await driver.send(notification)

      const mailArg = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>
      expect(mailArg['text']).toBe('Plain: test message')
    })

    it('sets text to undefined when no textTemplate is given', async () => {
      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: '<p>HTML only</p>',
        data: {},
      }

      await driver.send(notification)

      const mailArg = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>
      expect(mailArg['text']).toBeUndefined()
    })

    it('uses the configured from address', async () => {
      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: 'hi',
        data: {},
      }

      await driver.send(notification)

      const mailArg = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>
      expect(mailArg['from']).toBe('"Feathers BaaS" <no-reply@example.com>')
    })

    it('falls back to "(no subject)" when subject is not provided', async () => {
      const notification: Notification = {
        to: 'user@example.com',
        channel: 'email',
        bodyTemplate: 'body',
        data: {},
      }

      await driver.send(notification)

      const mailArg = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>
      expect(mailArg['subject']).toBe('(no subject)')
    })
  })
})
