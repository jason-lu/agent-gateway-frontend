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
