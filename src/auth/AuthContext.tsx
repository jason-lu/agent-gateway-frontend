import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, getToken, setToken } from '../api/client'
import { decodeJwt, isExpired, type JwtClaims } from '../lib/jwt'

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

function readStoredUser(): AuthState | null {
  const token = getToken()
  if (!token) return null
  const claims: JwtClaims | null = decodeJwt(token)
  if (!claims || isExpired(claims)) {
    setToken(null)
    return null
  }
  return { username: claims.sub, roles: claims.roles }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(readStoredUser)

  const login = useCallback(async (username: string, password: string) => {
    const { token } = await api.login({ username, password })
    const claims = decodeJwt(token)
    setToken(token)
    setUser({
      username: claims?.sub ?? username,
      roles: claims?.roles ?? [],
    })
  }, [])

  const logout = useCallback(() => {
    setToken(null)
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
