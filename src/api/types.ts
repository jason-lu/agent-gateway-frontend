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

/** One tool call on an assistant turn, as stored (`tool_calls[]` entry). */
export interface ToolCall {
  id: string
  name: string
  arguments: string
}

/**
 * One stored turn in raw form for debug exports: every role including system
 * prompts, memory-compression summaries (their content carries the summary
 * marker), and tool traffic. Images are as stored — `ref:<sessionId>/<imageId>`
 * for externalised pixels, untouched data URIs otherwise.
 */
export interface RawMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string | null
  toolCalls?: ToolCall[] | null
  images?: string[] | null
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

/** One admin-configured LLM provider: a connection plus the model IDs it offers. */
export interface LlmProviderResponse {
  id: string
  name: string
  baseUrl: string
  /** Masked with SECRET_MASK — the real key never leaves the server. */
  apiKey: string | null
  models: string[]
  defaultModel: string
  /** The deployment default: at least one provider always holds it and it cannot be deleted. */
  primary: boolean
}

/**
 * Create/update body for a provider. On update, a blank (or SECRET_MASK) apiKey
 * keeps the stored key; create needs a real key.
 */
export interface LlmProviderRequest {
  name: string
  baseUrl: string
  apiKey?: string | null
  models: string[]
  defaultModel: string
}

/**
 * Draft connection for a model probe. {@code id} anchors the merge to a stored
 * provider so a blank field (or SECRET_MASK on the key) keeps its stored value.
 */
export interface LlmProviderProbeRequest {
  id?: string | null
  baseUrl?: string | null
  apiKey?: string | null
}

/** Model IDs detected on the probed upstream (OpenAI-compatible GET /models). */
export interface AdminLlmModelsResponse {
  models: string[]
}

/** One pickable model in the chat window: which provider offers it and under what name. */
export interface LlmModelOption {
  providerId: string
  providerName: string
  model: string
}

/** A concrete (provider, model) choice — what a user picks and what a turn uses. */
export interface LlmModelChoice {
  providerId: string
  model: string
}

/**
 * The chat-window model picker: every pair on offer, the deployment default, and
 * the caller's effective selection (their saved choice, else the default).
 */
export interface LlmModelCatalog {
  models: LlmModelOption[]
  defaultChoice: LlmModelChoice | null
  selected: LlmModelChoice | null
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

/** Outbound SMTP account for invite mails. password is masked with SECRET_MASK. */
export interface EmailSettingsResponse {
  host: string
  port: number
  username: string
  /** Masked with SECRET_MASK when set — the real password never leaves the server. */
  password: string
  fromAddress: string
  useSsl: boolean
}

/**
 * Update body for the SMTP account. On update, a blank (or SECRET_MASK) password
 * keeps the stored one.
 */
export interface EmailSettingsRequest {
  host: string
  port: number
  username: string
  password?: string | null
  fromAddress: string
  useSsl: boolean
}

/** One registration invite code and its delivery/consumption state. */
export interface InviteCodeResponse {
  code: string
  email: string
  note: string
  createdBy: string
  createdAt: string
  expiresAt: string
  sentAt: string | null
  usedBy: string | null
  usedAt: string | null
}

export interface CreateInviteRequest {
  email: string
  note?: string | null
  validDays?: number | null
}

export interface RegisterRequest {
  inviteCode: string
  username: string
  password: string
}

export interface ErrorResponse {
  status: number
  error: string
  message: string
}
