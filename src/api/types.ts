export type Role = 'user' | 'assistant'

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  tokenType: string
  expiresIn: number
  refreshToken: string
}

export interface RefreshRequest {
  refreshToken: string
}

export interface LogoutRequest {
  refreshToken: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface SessionResponse {
  id: string
  owner: string
  title: string | null
  createdAt: string
  messageCount: number
}

export interface CreateSessionRequest {
  systemPrompt?: string
}

export interface HistoryMessage {
  role: Role
  content: string
  /** image URLs or data: URIs attached to the turn (vision input) */
  images?: string[]
}

export interface MessageResponse {
  reply: string
}

export interface HealthResponse {
  status: string
  llmConfigured: boolean
  dbUp: boolean
}

export interface AdminUserResponse {
  username: string
  roles: string[]
}

/** Where an effective LLM field comes from: admin overrides, the environment, or nowhere. */
export type LlmSettingsSource = 'admin' | 'env' | 'none'

export interface AdminLlmSettingsResponse {
  /** Admin override, or null when the field falls back to the environment. */
  baseUrl: string | null
  /** Masked with SECRET_MASK when an admin key is stored; never the real key. */
  apiKey: string | null
  model: string | null
  effectiveBaseUrl: string | null
  effectiveModel: string | null
  baseUrlSource: LlmSettingsSource
  apiKeySource: LlmSettingsSource
  modelSource: LlmSettingsSource
  configured: boolean
}

/**
 * Per field: null keeps the stored override, '' clears it (falls back to the
 * environment), a value replaces it. SECRET_MASK on apiKey keeps the stored key.
 */
export interface AdminLlmSettingsRequest {
  baseUrl?: string | null
  apiKey?: string | null
  model?: string | null
}

/** Secrets are masked server-side; the mask value means "keep what is stored". */
export const SECRET_MASK = '••••••••'

export type McpTransport = 'stdio' | 'http'

export type McpServerStatus = 'connected' | 'disconnected' | 'disabled' | 'unknown'

export interface McpServerResponse {
  name: string
  transport: McpTransport
  command: string | null
  args: string[]
  env: Record<string, string>
  url: string | null
  headers: Record<string, string>
  enabled: boolean
  status: McpServerStatus
}

export interface McpServerRequest {
  name: string
  transport: McpTransport
  command?: string | null
  args?: string[]
  env?: Record<string, string>
  url?: string | null
  headers?: Record<string, string>
  enabled: boolean
}

export interface ErrorResponse {
  status: number
  error: string
  message: string
}
