import { NotAuthenticated, BadRequest } from '@feathersjs/errors'
import type { Application } from '../declarations.js'

type KoaContext = {
  method: string
  path: string
  status: number
  body: unknown
  request: { body?: unknown }
}

function decodeJwtHeader(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function configureRefresh(app: Application): void {
  const koaApp = app as unknown as { use(mw: (ctx: KoaContext, next: () => Promise<void>) => Promise<void>): void }

  koaApp.use(async (ctx, next) => {
    if (ctx.method !== 'POST' || ctx.path !== '/authentication/refresh') {
      return next()
    }

    const body = (ctx.request.body ?? {}) as Record<string, unknown>
    const refreshToken = body['refreshToken']

    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new BadRequest('refreshToken is required')
    }

    // Verify signature, expiry, audience and issuer using the auth service
    const authService = app.service('authentication') as unknown as {
      verifyAccessToken(token: string): Promise<{ sub?: string }>
      createAccessToken(payload: Record<string, unknown>, opts?: Record<string, unknown>): Promise<string>
    }

    let payload: { sub?: string }
    try {
      payload = await authService.verifyAccessToken(refreshToken)
    } catch {
      throw new NotAuthenticated('Invalid or expired refresh token')
    }

    // Reject access tokens submitted to this endpoint
    if (decodeJwtHeader(refreshToken)['typ'] !== 'refresh') {
      throw new NotAuthenticated('Invalid token type')
    }

    const userId = payload.sub
    if (!userId) throw new NotAuthenticated('Invalid refresh token payload')

    // Fetch the current user record (internal call — bypasses authenticate hook)
    const user = await app.service('users').get(userId)

    // Issue a new access token with the standard access token options
    const accessToken = await authService.createAccessToken({ sub: userId })

    ctx.status = 200
    ctx.body = { accessToken, user }
  })
}
