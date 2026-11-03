import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  api,
  clearSession,
  getRefreshToken,
  getToken,
  refreshSession,
  setRefreshToken,
  setToken,
} from '../api/client'
import { decodeJwt, type JwtClaims } from '../lib/jwt'

interface AuthState {
  username: string
  roles: string[]
}

interface AuthContextValue {
  user: AuthState | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * A stored session counts as signed-in while a refresh token exists. The access
 * JWT may already be expired — claims are still readable, and the first API call
 * silently renews the pair.
 */
function readStoredUser(): AuthState | null {
  const token = getToken()
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    if (token) clearSession()
    return null
  }
  const claims: JwtClaims | null = token ? decodeJwt(token) : null
  if (!claims) {
    // No readable access token left; the refresh will restore identity on demand.
    return { username: '', roles: [] }
  }
  return { username: claims.sub, roles: claims.roles }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(readStoredUser)

  // Refresh exists but the access token is missing/unreadable: renew once so the
  // identity (avatar, roles) is restored without a trip to the login page.
  useEffect(() => {
    const stored = getToken()
    const claims = stored ? decodeJwt(stored) : null
    if (claims || !getRefreshToken()) return
    void refreshSession().then((token) => {
      const renewed = token ? decodeJwt(token) : null
      if (renewed) setUser({ username: renewed.sub, roles: renewed.roles })
    })
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const { token, refreshToken } = await api.login({ username, password })
    setToken(token)
    setRefreshToken(refreshToken)
    const claims = decodeJwt(token)
    setUser({
      username: claims?.sub ?? username,
      roles: claims?.roles ?? [],
    })
  }, [])

  const logout = useCallback(() => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      // Best-effort revocation; the local session dies either way.
      void api.logout(refreshToken).catch(() => {})
    }
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

export function useIsAdmin(): boolean {
  const { user } = useAuth()
  return !!user?.roles.includes('ADMIN')
}
