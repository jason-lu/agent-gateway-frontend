import type { RawMessage, SessionResponse } from '../api/types'

/** One session plus its full raw transcript, ready to serialize. */
export interface ExportSession {
  id: string
  title: string
  createdAt: string
  messages: RawMessage[]
}

/** Assembles the export payload from session metadata and fetched raw history. */
export function toExportSession(
  session: SessionResponse,
  messages: RawMessage[],
  titleHint?: string,
): ExportSession {
  // Same fallback chain the sidebar title hint uses: server title, local hint,
  // then the first user line — so a fresh session still exports under a name.
  const firstUser = messages.find((m) => m.role === 'user' && m.content)
  const fromContent = firstUser
    ? firstUser.content.replace(/\s+/g, ' ').trim().slice(0, 28)
    : ''
  return {
    id: session.id,
    title: session.title || titleHint?.trim() || fromContent || '未命名会话',
    createdAt: session.createdAt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
      ...(m.toolCalls?.length ? { toolCalls: m.toolCalls } : {}),
      ...(m.images?.length ? { images: m.images } : {}),
    })),
  }
}

/**
 * JSON envelope: stable shape for tooling, one or many sessions alike. Messages
 * are the raw log — every role, system prompts and memory-compression summaries
 * included, tool traffic as `toolCalls` / `toolCallId` — so one file is enough
 * to debug a session.
 */
export function buildJson(sessions: ExportSession[]): string {
  return JSON.stringify(
    {
      app: 'agent-gateway',
      type: 'chat-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions,
    },
    null,
    2,
  )
}

/**
 * Human-readable transcript. Only the user/assistant turns are rendered — tool
 * traffic and summaries are debug data and stay in the JSON export. Images are
 * counted, not embedded: stored refs do not resolve outside the app and data
 * URIs bloat the text.
 */
export function buildMarkdown(sessions: ExportSession[]): string {
  const exportedAt = formatLocal(new Date())
  const parts: string[] = []

  if (sessions.length === 1) {
    const s = sessions[0]
    const shown = cleanTranscript(s.messages)
    parts.push(`# ${s.title}`, '')
    parts.push(
      `> 导出自 agent gateway · 导出时间：${exportedAt} · 会话 ID：${s.id} · 共 ${shown.length} 条消息`,
      '',
    )
    parts.push(...renderMessages(shown))
  } else {
    parts.push(`# 聊天记录导出`, '')
    parts.push(`> 导出自 agent gateway · 导出时间：${exportedAt} · 共 ${sessions.length} 个会话`, '')
    for (const s of sessions) {
      const shown = cleanTranscript(s.messages)
      parts.push('---', '')
      parts.push(`## ${s.title}`, '')
      parts.push(
        `> 创建于：${formatLocal(new Date(s.createdAt))} · 会话 ID：${s.id} · 共 ${shown.length} 条消息`,
        '',
      )
      parts.push(...renderMessages(shown))
    }
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

/** Triggers a browser download of one UTF-8 text file. */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** `聊天记录-<title>-20260219-1430.json` — safe on Windows, sortable by date. */
export function exportFilename(scope: 'session' | 'all', title: string, ext: 'json' | 'md'): string {
  const stamp = (() => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
  })()
  const slug = (scope === 'all' ? '全部会话' : title).replace(/[\\/:*?"<>|]/g, '-').slice(0, 40)
  return `聊天记录-${slug}-${stamp}.${ext}`
}

/** The user-visible turns only — same filter the history endpoint applies. */
function cleanTranscript(messages: RawMessage[]): RawMessage[] {
  return messages.filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content.trim().length > 0))
}

function renderMessages(messages: RawMessage[]): string[] {
  const out: string[] = []
  for (const m of messages) {
    out.push(`**${m.role === 'user' ? '你' : 'Agent'}**`, '')
    if (m.images?.length) out.push(`*[附图 ${m.images.length} 张]*`, '')
    if (m.content) out.push(m.content, '')
  }
  return out
}

function formatLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
