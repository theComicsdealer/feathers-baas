import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NotificationJob, Notification } from '../src/types.js'

// ─── Mock ioredis with ioredis-mock ───────────────────────────────────────────
vi.mock('ioredis', async () => {
  const IORedisMock = (await import('ioredis-mock')).default
  return { default: IORedisMock, Redis: IORedisMock }
})

// ─── Mock BullMQ ─────────────────────────────────────────────────────────────
const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-1' })
const mockQueueClose = vi.fn().mockResolvedValue(undefined)
const mockWorkerClose = vi.fn().mockResolvedValue(undefined)
let capturedProcessor: ((job: { data: NotificationJob }) => Promise<void>) | undefined

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
  Worker: vi.fn().mockImplementation((_name: string, processor: (job: { data: NotificationJob }) => Promise<void>) => {
    capturedProcessor = processor
    return {
      on: vi.fn(),
      close: mockWorkerClose,
    }
  }),
}))

// ─── Imports after mocking ────────────────────────────────────────────────────
import { createNotificationQueue, enqueueNotification, NOTIFICATION_QUEUE_NAME } from '../src/queue/producer.js'
import { createNotificationWorker } from '../src/queue/worker.js'
import { DriverRegistry } from '../src/registry.js'
import type { NotifierDriver } from '../src/types.js'

// ─── Tests ────────────────────────────────────────────────────────────────────

const fakeNotification: Notification = {
  to: 'user@example.com',
  channel: 'email',
  subject: 'Test',
  bodyTemplate: '<p>Hello <%= name %></p>',
  data: { name: 'Alice' },
}

describe('createNotificationQueue', () => {
  it('creates a BullMQ Queue with the correct name', async () => {
    const { Queue } = await import('bullmq')
    const Redis = (await import('ioredis')).default
    const redis = new Redis() as unknown as import('ioredis').Redis
    createNotificationQueue(redis)
    expect(vi.mocked(Queue)).toHaveBeenCalledWith(
      NOTIFICATION_QUEUE_NAME,
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          attempts: 5,
          backoff: expect.objectContaining({ type: 'exponential' }),
        }),
      }),
    )
  })
})

describe('enqueueNotification', () => {
  beforeEach(() => mockQueueAdd.mockClear())

  it('adds a job with the correct payload', async () => {
    const { Queue } = await import('bullmq')
    const Redis = (await import('ioredis')).default
    const redis = new Redis() as unknown as import('ioredis').Redis
    const queue = createNotificationQueue(redis) as unknown as Parameters<typeof enqueueNotification>[0]

    const job: NotificationJob = { driverName: 'smtp', notification: fakeNotification }
    await enqueueNotification(queue, job)

    expect(mockQueueAdd).toHaveBeenCalledWith('send', job)
  })
})

describe('createNotificationWorker', () => {
  let registry: DriverRegistry

  beforeEach(() => {
    capturedProcessor = undefined
    registry = new DriverRegistry()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a BullMQ Worker with the correct queue name', async () => {
    const { Worker } = await import('bullmq')
    const Redis = (await import('ioredis')).default
    const redis = new Redis() as unknown as import('ioredis').Redis
    createNotificationWorker(registry, redis, { concurrency: 3 })
    expect(vi.mocked(Worker)).toHaveBeenCalledWith(
      NOTIFICATION_QUEUE_NAME,
      expect.any(Function),
      expect.objectContaining({ concurrency: 3 }),
    )
  })

  it('calls the driver.send() when a job is processed', async () => {
    const Redis = (await import('ioredis')).default
    const redis = new Redis() as unknown as import('ioredis').Redis

    const mockSend = vi.fn().mockResolvedValue(undefined)
    const fakeDriver: NotifierDriver = { name: 'smtp', send: mockSend }
    registry.registerDriver(fakeDriver)

    createNotificationWorker(registry, redis)

    expect(capturedProcessor).toBeDefined()

    const job: NotificationJob = { driverName: 'smtp', notification: fakeNotification }
    await capturedProcessor!({ data: job })

    expect(mockSend).toHaveBeenCalledOnce()
    expect(mockSend).toHaveBeenCalledWith(fakeNotification)
  })

  it('throws when the driver is not registered', async () => {
    const Redis = (await import('ioredis')).default
    const redis = new Redis() as unknown as import('ioredis').Redis
    createNotificationWorker(registry, redis)

    const job: NotificationJob = { driverName: 'unknown-driver', notification: fakeNotification }
    await expect(capturedProcessor!({ data: job })).rejects.toThrow(/not registered/)
  })
})
