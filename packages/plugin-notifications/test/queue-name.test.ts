// Startup smoke test against the real bullmq — it rejects ':' in queue names at construction time.
import { describe, it, expect } from 'vitest'
import { Queue } from 'bullmq'
import { NOTIFICATION_QUEUE_NAME, NOTIFICATION_QUEUE_PREFIX } from '../src/queue/producer.js'

describe('notification queue name', () => {
  it('is accepted by the bullmq Queue constructor', () => {
    let queue: Queue | undefined
    expect(() => {
      // Port 0 + lazyConnect: never actually reaches for Redis
      queue = new Queue(NOTIFICATION_QUEUE_NAME, {
        prefix: NOTIFICATION_QUEUE_PREFIX,
        connection: { host: '127.0.0.1', port: 0, lazyConnect: true, enableOfflineQueue: false },
      })
    }).not.toThrow()
    queue?.on('error', () => {})
    expect(queue?.name).toBe(NOTIFICATION_QUEUE_NAME)
  })
})
