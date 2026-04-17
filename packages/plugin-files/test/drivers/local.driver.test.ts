import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import * as jwt from 'jsonwebtoken'
import { LocalDriver } from '../../src/drivers/local.driver.js'

const TEST_DIR = join(tmpdir(), `feathers-baas-local-driver-test-${process.pid}`)
const JWT_SECRET = 'test-secret-32-chars-xxxxxxxxxxxxxxxxx'
const BASE_URL = 'http://localhost:3030'

let driver: LocalDriver

beforeAll(async () => {
  await mkdir(TEST_DIR, { recursive: true })
  driver = new LocalDriver({ directory: TEST_DIR, jwtSecret: JWT_SECRET, baseUrl: BASE_URL })
})

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true })
})

describe('LocalDriver', () => {
  describe('put', () => {
    it('writes a file and returns the correct key and size', async () => {
      const content = 'hello feathers-baas'
      const stream = Readable.from([content])
      const result = await driver.put('test/hello.txt', stream, {
        mimeType: 'text/plain',
        originalName: 'hello.txt',
      })

      expect(result.key).toBe('test/hello.txt')
      expect(result.size).toBe(Buffer.byteLength(content))
    })

    it('creates nested directories if they do not exist', async () => {
      const stream = Readable.from(['nested content'])
      const result = await driver.put('deep/nested/dir/file.txt', stream, {
        mimeType: 'text/plain',
        originalName: 'file.txt',
      })
      expect(result.key).toBe('deep/nested/dir/file.txt')
    })
  })

  describe('get', () => {
    it('returns a readable stream with the stored content', async () => {
      const content = 'get test content'
      await driver.put('get-test.txt', Readable.from([content]), {
        mimeType: 'text/plain',
        originalName: 'get-test.txt',
      })

      const readStream = await driver.get('get-test.txt')
      const chunks: Buffer[] = []
      for await (const chunk of readStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
      }
      expect(Buffer.concat(chunks).toString()).toBe(content)
    })
  })

  describe('delete', () => {
    it('removes the file from the filesystem', async () => {
      await driver.put('to-delete.txt', Readable.from(['bye']), {
        mimeType: 'text/plain',
        originalName: 'to-delete.txt',
      })
      await driver.delete('to-delete.txt')

      // createReadStream is lazy; errors only surface when consuming the stream
      const readStream = await driver.get('to-delete.txt')
      await expect(async () => {
        for await (const _ of readStream) { /* drain */ }
      }).rejects.toThrow(/ENOENT/)
    })
  })

  describe('signUrl', () => {
    it('returns a URL containing a JWT token', async () => {
      const url = await driver.signUrl('some/file.pdf', 3600)

      expect(url).toContain(BASE_URL)
      expect(url).toContain('/files/download?token=')

      // Extract and verify the token
      const tokenMatch = url.match(/token=([^&]+)/)
      expect(tokenMatch).not.toBeNull()
      const token = decodeURIComponent(tokenMatch![1]!)
      const payload = jwt.verify(token, JWT_SECRET) as { key: string }
      expect(payload.key).toBe('some/file.pdf')
    })

    it('produces tokens that expire', async () => {
      const url = await driver.signUrl('expiring.txt', 1)
      const tokenMatch = url.match(/token=([^&]+)/)
      const token = decodeURIComponent(tokenMatch![1]!)
      const payload = jwt.decode(token) as { exp: number }
      // expiry should be ~1 second from now
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
      expect(payload.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 2)
    })
  })

  describe('list', () => {
    it('lists files under a prefix', async () => {
      await driver.put('listing/a.txt', Readable.from(['a']), {
        mimeType: 'text/plain',
        originalName: 'a.txt',
      })
      await driver.put('listing/b.txt', Readable.from(['bb']), {
        mimeType: 'text/plain',
        originalName: 'b.txt',
      })

      const entries = await driver.list('listing')
      expect(entries.length).toBeGreaterThanOrEqual(2)
      const keys = entries.map((e) => e.key)
      expect(keys.some((k) => k.includes('a.txt'))).toBe(true)
      expect(keys.some((k) => k.includes('b.txt'))).toBe(true)
    })

    it('returns an empty array for a non-existent prefix', async () => {
      const entries = await driver.list('does/not/exist')
      expect(entries).toEqual([])
    })
  })
})
