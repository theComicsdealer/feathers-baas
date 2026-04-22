import { JWTStrategy } from '@feathersjs/authentication'
import { NotAuthenticated } from '@feathersjs/errors'
import type { Params } from '@feathersjs/feathers'

interface KoaCookieJar {
  get(name: string): string | undefined
  set(name: string, value: string | null, options?: Record<string, unknown>): void
}

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

      const cookies = (params.connection as { cookies?: KoaCookieJar } | undefined)?.cookies
      const refreshToken = cookies?.get('feathers-refresh')
      if (!refreshToken) throw new NotAuthenticated('Access token expired')

      const authService = this.app!.service('authentication') as unknown as {
        verifyAccessToken(token: string): Promise<{ sub?: string }>
      }

      let payload: { sub?: string }
      try {
        payload = await authService.verifyAccessToken(refreshToken)
      } catch {
        cookies?.set('feathers-refresh', null, { maxAge: 0, path: '/authentication' })
        throw new NotAuthenticated('Refresh token invalid or expired')
      }

      if (decodeJwtHeader(refreshToken)['typ'] !== 'refresh') {
        throw new NotAuthenticated('Invalid token type')
      }

      const userId = payload.sub
      if (!userId) throw new NotAuthenticated('Invalid refresh token')

      const user = await this.app!.service('users').get(userId)

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
