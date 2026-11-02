import type {
  AdminUserResponse,
  CreateSessionRequest,
  HealthResponse,
  HistoryMessage,
  LoginRequest,
  LoginResponse,
  MessageResponse,
  SessionResponse,
} from './types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const TOKEN_KEY = 'agent.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function parseError(response: Response): Promise<never> {
  let message = `请求失败（${response.status}）`
  try {
    const body = await response.json()
    if (typeof body?.message === 'string' && body.message) message = body.message
    else if (typeof body?.error === 'string' && body.error) message = body.error
  } catch {
    // keep the generic message
  }
  throw new ApiError(response.status, message)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')

  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(path, { ...init, headers })
  if (!response.ok) await parseError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  health: () => request<HealthResponse>('/api/v1/health'),

  login: (body: LoginRequest) =>
    request<LoginResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  listSessions: () => request<SessionResponse[]>('/api/v1/sessions'),

  createSession: (body: CreateSessionRequest = {}) =>
    request<SessionResponse>('/api/v1/sessions', { method: 'POST', body: JSON.stringify(body) }),

  getSession: (id: string) => request<SessionResponse>(`/api/v1/sessions/${id}`),

  deleteSession: (id: string) =>
    request<void>(`/api/v1/sessions/${id}`, { method: 'DELETE' }),

  history: (id: string) => request<HistoryMessage[]>(`/api/v1/sessions/${id}/messages`),

  send: (id: string, content: string) =>
    request<MessageResponse>(`/api/v1/sessions/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  adminUsers: () => request<AdminUserResponse[]>('/api/v1/admin/users'),
}
