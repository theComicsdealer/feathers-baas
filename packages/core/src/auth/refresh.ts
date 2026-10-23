import { NotAuthenticated, BadRequest } from '@feathersjs/errors'
import type { Application } from '../declarations.js'
import { sanitizeUser } from './sanitize.js'

function decodeJwtHeader(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString()) as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * POST /authentication/refresh — exchange a refresh token for a new access token.
 *
 * Registered as a service (not Koa middleware) so the REST router dispatches it:
 * a static `authentication/refresh` route wins over `authentication/:id`, and
 * `create` answers 201 like POST /authentication.
 */
export class RefreshService {
  constructor(private app: Application) {}

  async create(data: { refreshToken?: unknown }) {
    const refreshToken = data?.refreshToken

    // 400 means a malformed request, not an invalid token — those are always 401
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new BadRequest('refreshToken is required')
    }

    // Verify signature, expiry, audience and issuer using the auth service
    const authService = this.app.service('authentication')

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

    // Internal call — bypasses the authenticate hook, and with it removeVerification
    const user = (await this.app.service('users').get(userId)) as unknown as Record<string, unknown>

    // Issue a new access token with the standard access token options
    const accessToken = await authService.createAccessToken({ sub: userId })

    return { accessToken, user: sanitizeUser(user) }
  }
}

export function configureRefresh(app: Application): void {
  app.use('authentication/refresh', new RefreshService(app), { methods: ['create'], events: [] })
}
