import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Readable } from 'node:stream'

// ─── Mock @aws-sdk/client-s3 ─────────────────────────────────────────────────

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
  GetObjectCommand: vi.fn().mockImplementation((params) => ({ _type: 'GetObject', ...params })),
  DeleteObjectCommand: vi.fn().mockImplementation((params) => ({ _type: 'DeleteObject', ...params })),
  ListObjectsV2Command: vi.fn().mockImplementation((params) => ({ _type: 'ListObjects', ...params })),
}))

vi.mock('@aws-sdk/lib-storage', () => ({
  Upload: vi.fn().mockImplementation(() => ({
    done: vi.fn().mockResolvedValue({}),
  })),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/signed-url?X-Amz-Expires=3600'),
}))

// ─── Import after mocking ─────────────────────────────────────────────────────

import { S3Driver } from '../../src/drivers/s3.driver.js'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('S3Driver', () => {
  let driver: S3Driver

  beforeEach(() => {
    mockSend.mockReset()
    driver = new S3Driver({
      bucket: 'test-bucket',
      region: 'us-east-1',
      accessKeyId: 'AKIA_TEST',
      secretAccessKey: 'secret',
    })
  })

  describe('put', () => {
    it('calls Upload.done() and returns key + size', async () => {
      const stream = Readable.from(['file content'])
      const result = await driver.put('uploads/test.txt', stream, {
        mimeType: 'text/plain',
        originalName: 'test.txt',
        size: 12,
      })
      expect(result.key).toBe('uploads/test.txt')
      expect(result.size).toBe(12) // falls back to meta.size
    })

    it('uses mimeType in upload params', async () => {
      const { Upload } = await import('@aws-sdk/lib-storage')
      const stream = Readable.from(['img'])
      await driver.put('photos/img.jpg', stream, {
        mimeType: 'image/jpeg',
        originalName: 'img.jpg',
      })
      const uploadCtor = vi.mocked(Upload)
      expect(uploadCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            Key: 'photos/img.jpg',
            ContentType: 'image/jpeg',
            Bucket: 'test-bucket',
          }),
        }),
      )
    })
  })

  describe('get', () => {
    it('sends GetObjectCommand and returns the body as a stream', async () => {
      const fakeBody = Readable.from(['s3 content'])
      mockSend.mockResolvedValueOnce({ Body: fakeBody })

      const stream = await driver.get('uploads/test.txt')
      expect(stream).toBe(fakeBody)
    })

    it('throws when body is undefined', async () => {
      mockSend.mockResolvedValueOnce({ Body: undefined })
      await expect(driver.get('missing.txt')).rejects.toThrow(/empty body/)
    })
  })

  describe('delete', () => {
    it('sends DeleteObjectCommand', async () => {
      mockSend.mockResolvedValueOnce({})
      await driver.delete('uploads/old.txt')
      expect(mockSend).toHaveBeenCalledOnce()
    })
  })

  describe('signUrl', () => {
    it('returns a pre-signed URL from the SDK', async () => {
      const url = await driver.signUrl('private/doc.pdf', 3600)
      expect(url).toContain('signed-url')
      expect(url).toContain('X-Amz-Expires')
    })
  })

  describe('list', () => {
    it('maps S3 Contents to FileListEntry[]', async () => {
      const now = new Date()
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'docs/a.pdf', Size: 1024, LastModified: now },
          { Key: 'docs/b.pdf', Size: 2048, LastModified: now },
        ],
      })
      const entries = await driver.list('docs/')
      expect(entries).toHaveLength(2)
      expect(entries[0]).toMatchObject({ key: 'docs/a.pdf', size: 1024 })
      expect(entries[1]).toMatchObject({ key: 'docs/b.pdf', size: 2048 })
    })

    it('returns an empty array when Contents is undefined', async () => {
      mockSend.mockResolvedValueOnce({ Contents: undefined })
      const entries = await driver.list('empty/')
      expect(entries).toEqual([])
    })
  })
})
