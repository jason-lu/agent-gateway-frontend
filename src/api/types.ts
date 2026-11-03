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
  createdAt: string
  messageCount: number
}

export interface CreateSessionRequest {
  systemPrompt?: string
}

export interface HistoryMessage {
  role: Role
  content: string
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

export interface ErrorResponse {
  status: number
  error: string
  message: string
}
