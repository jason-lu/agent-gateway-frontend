/** Decode a JWT payload without verifying it — the token is already client-side. */
export interface JwtClaims {
  sub: string
  roles: string[]
  exp?: number
}

export function decodeJwt(token: string): JwtClaims | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = decodeURIComponent(
      Array.from(atob(padded), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    )
    const payload = JSON.parse(json)
    if (typeof payload.sub !== 'string') return null
    return {
      sub: payload.sub,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    }
  } catch {
    return null
  }
}

export function isExpired(claims: JwtClaims | null): boolean {
  if (!claims?.exp) return false
  return claims.exp * 1000 <= Date.now()
}
