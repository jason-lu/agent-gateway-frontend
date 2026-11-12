import type {
  AdminLlmModelsResponse,
  AdminUserResponse,
  ChangePasswordRequest,
  CreateSessionRequest,
  HealthResponse,
  HistoryMessage,
  LoginRequest,
  LoginResponse,
  LlmModelCatalog,
  LlmModelChoice,
  LlmProviderProbeRequest,
  LlmProviderRequest,
  LlmProviderResponse,
  McpServerRequest,
  McpServerResponse,
  MessageResponse,
  RawMessage,
  RefreshRequest,
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
const REFRESH_KEY = 'agent.refreshToken'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function setRefreshToken(token: string | null): void {
  if (token) localStorage.setItem(REFRESH_KEY, token)
  else localStorage.removeItem(REFRESH_KEY)
}

/** Drops both tokens — the caller decides whether the session is gone. */
export function clearSession(): void {
  setToken(null)
  setRefreshToken(null)
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

/**
 * Exchanges the refresh token for a new pair (rotation). Concurrent callers
 * share one in-flight request; null means the session is gone.
 */
let refreshInFlight: Promise<string | null> | null = null

export function refreshSession(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return Promise.resolve(null)
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!response.ok) {
          clearSession()
          return null
        }
        const body = (await response.json()) as LoginResponse
        setToken(body.token)
        setRefreshToken(body.refreshToken)
        return body.token
      } catch {
        clearSession()
        return null
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

/**
 * fetch with the bearer token attached; a 401 triggers one silent refresh and
 * retry. Returns the final response as-is (including non-2xx).
 */
export async function fetchWithAuth(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response = await fetch(path, { ...init, headers })
  if (response.status === 401 && getRefreshToken()) {
    const renewed = await refreshSession()
    if (renewed) {
      headers.set('Authorization', `Bearer ${renewed}`)
      response = await fetch(path, { ...init, headers })
    }
  }
  return response
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')

  const response = await fetchWithAuth(path, { ...init, headers })
  if (!response.ok) await parseError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  health: () => request<HealthResponse>('/api/v1/health'),

  login: (body: LoginRequest) =>
    request<LoginResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  refresh: (body: RefreshRequest) =>
    request<LoginResponse>('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify(body) }),

  logout: (refreshToken: string) =>
    request<void>('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  changePassword: (body: ChangePasswordRequest) =>
    request<void>('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),

  listSessions: () => request<SessionResponse[]>('/api/v1/sessions'),

  createSession: (body: CreateSessionRequest = {}) =>
    request<SessionResponse>('/api/v1/sessions', { method: 'POST', body: JSON.stringify(body) }),

  getSession: (id: string) => request<SessionResponse>(`/api/v1/sessions/${id}`),

  deleteSession: (id: string) =>
    request<void>(`/api/v1/sessions/${id}`, { method: 'DELETE' }),

  history: (id: string) => request<HistoryMessage[]>(`/api/v1/sessions/${id}/messages`),

  /** Unfiltered message log (system prompts, summaries, tool traffic) for debug export. */
  rawHistory: (id: string) => request<RawMessage[]>(`/api/v1/sessions/${id}/messages/raw`),

  send: (id: string, content: string, images?: string[]) =>
    request<MessageResponse>(`/api/v1/sessions/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, images }),
    }),

  adminUsers: () => request<AdminUserResponse[]>('/api/v1/admin/users'),

  adminLlmProviders: () => request<LlmProviderResponse[]>('/api/v1/admin/llm-providers'),

  createAdminLlmProvider: (body: LlmProviderRequest) =>
    request<LlmProviderResponse>('/api/v1/admin/llm-providers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateAdminLlmProvider: (id: string, body: LlmProviderRequest) =>
    request<LlmProviderResponse>(`/api/v1/admin/llm-providers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteAdminLlmProvider: (id: string) =>
    request<void>(`/api/v1/admin/llm-providers/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /** Moves the deployment default to this provider (which releases the old one for deletion). */
  promoteAdminLlmProvider: (id: string) =>
    request<LlmProviderResponse>(`/api/v1/admin/llm-providers/${encodeURIComponent(id)}/primary`, {
      method: 'POST',
    }),

  /** Probes the upstream for its model IDs; the body is the draft connection in the form. */
  listAdminLlmModels: (body: LlmProviderProbeRequest = {}) =>
    request<AdminLlmModelsResponse>('/api/v1/admin/llm-providers/models', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** What the chat window can pick, plus the caller's current selection. */
  llmModelCatalog: () => request<LlmModelCatalog>('/api/v1/llm/models'),

  /** Saves the model the caller picked in the chat window. */
  setMyLlmModel: (body: LlmModelChoice) =>
    request<LlmModelChoice>('/api/v1/llm/model', { method: 'PUT', body: JSON.stringify(body) }),

  listMcpServers: () => request<McpServerResponse[]>('/api/v1/settings/mcp-servers'),

  createMcpServer: (body: McpServerRequest) =>
    request<McpServerResponse>('/api/v1/settings/mcp-servers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateMcpServer: (name: string, body: McpServerRequest) =>
    request<McpServerResponse>(`/api/v1/settings/mcp-servers/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteMcpServer: (name: string) =>
    request<void>(`/api/v1/settings/mcp-servers/${encodeURIComponent(name)}`, { method: 'DELETE' }),
}
