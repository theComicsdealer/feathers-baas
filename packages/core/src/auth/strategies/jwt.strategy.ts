import { JWTStrategy } from '@feathersjs/authentication'
import { NotAuthenticated } from '@feathersjs/errors'
import type { Params } from '@feathersjs/feathers'
import type { Application } from '../../declarations.js'
import { REFRESH_COOKIE_NAME, getCookieJar, clearRefreshCookie } from '../cookie.js'
import { sanitizeUser } from '../sanitize.js'

function decodeJwtHeader(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export class BaasJWTStrategy extends JWTStrategy {
  override async authenticate(data: { accessToken?: string }, params: Params) {
    try {
      return await super.authenticate(data, params)
    } catch (err: unknown) {
      // Only attempt cookie-based refresh for expired tokens — all other errors propagate as-is
      if ((err as { data?: { name?: string } }).data?.name !== 'TokenExpiredError') throw err

      const refreshToken = getCookieJar(params)?.get(REFRESH_COOKIE_NAME)
      if (!refreshToken) throw new NotAuthenticated('Access token expired')

      const authService = this.app!.service('authentication') as unknown as {
        verifyAccessToken(token: string): Promise<{ sub?: string }>
      }

      let payload: { sub?: string }
      try {
        payload = await authService.verifyAccessToken(refreshToken)
      } catch {
        clearRefreshCookie((this.app as Application).get('config'), params)
        throw new NotAuthenticated('Refresh token invalid or expired')
      }

      if (decodeJwtHeader(refreshToken)['typ'] !== 'refresh') {
        throw new NotAuthenticated('Invalid token type')
      }

      const userId = payload.sub
      if (!userId) throw new NotAuthenticated('Invalid refresh token')

      // Internal call — removeVerification no-ops, so strip verification fields ourselves
      const user = sanitizeUser((await this.app!.service('users').get(userId)) as Record<string, unknown>)

      // AuthenticationService.create() calls getPayload({ user }) then createAccessToken()
      // — so it replaces accessToken with a fresh one. We pass the expired token to satisfy the type.
      return {
        accessToken: data.accessToken,
        authentication: { strategy: 'jwt', accessToken: data.accessToken, payload: { sub: userId } },
        user,
      }
    }
  }
}
