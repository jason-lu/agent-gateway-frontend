import { useState } from 'react'
import type { HealthResponse, SessionResponse } from '../api/types'

interface SidebarProps {
  sessions: SessionResponse[]
  selectedId: string | null
  titles: Record<string, string>
  health: HealthResponse | null
  username: string
  isAdmin: boolean
  busy: boolean
  onSelect: (id: string) => void
  onCreate: (systemPrompt?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onLogout: () => void
  onOpenAdmin: () => void
}

export function Sidebar({
  sessions,
  selectedId,
  titles,
  health,
  username,
  isAdmin,
  busy,
  onSelect,
  onCreate,
  onDelete,
  onLogout,
  onOpenAdmin,
}: SidebarProps) {
  const [composing, setComposing] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [creating, setCreating] = useState(false)

  async function confirmCreate() {
    setCreating(true)
    try {
      await onCreate(systemPrompt.trim() || undefined)
      setSystemPrompt('')
      setComposing(false)
    } finally {
      setCreating(false)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="brand">
          <div className="brand-badge">a</div>
          <div className="brand-name">
            agent <span>/ gateway</span>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setComposing((v) => !v)}>
          + 新建会话
        </button>

        {composing ? (
          <div className="new-session">
            <label className="field-label" htmlFor="system-prompt">
              系统提示词（可选）
            </label>
            <textarea
              id="system-prompt"
              className="textarea"
              rows={3}
              placeholder="例如：回答尽量简短。"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
            <div className="new-session-actions">
              <button className="btn" onClick={() => setComposing(false)} disabled={creating}>
                取消
              </button>
              <button className="btn btn-primary" onClick={() => void confirmCreate()} disabled={creating}>
                {creating ? <span className="spinner" /> : null}
                创建
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="sidebar-section-title">
        <span>会话</span>
        <span>{sessions.length}</span>
      </div>

      <div className="session-list">
        {busy ? (
          <div className="session-empty">
            <span className="spinner" /> 正在加载…
          </div>
        ) : sessions.length === 0 ? (
          <div className="session-empty">
            还没有会话。
            <br />
            点击上方「新建会话」开始。
          </div>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              className={`session-row${s.id === selectedId ? ' active' : ''}`}
              onClick={() => onSelect(s.id)}
            >
              <span className="session-row-main">
                <span className="session-row-title">{titles[s.id] || formatDate(s.createdAt)}</span>
                <span className="session-row-meta">
                  <span className="chip">{String(s.messageCount).padStart(2, '0')} msg</span>
                  <span>{formatTime(s.createdAt)}</span>
                </span>
              </span>
              <span
                className="session-row-delete"
                role="button"
                tabIndex={0}
                aria-label="删除会话"
                onClick={(e) => {
                  e.stopPropagation()
                  void onDelete(s.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    void onDelete(s.id)
                  }
                }}
              >
                ✕
              </span>
            </button>
          ))
        )}
      </div>

      <div className="sidebar-foot">
        <div className="status-row">
          <span
            className={`status-dot ${
              !health ? '' : health.status === 'UP' && health.llmConfigured ? 'up' : 'down'
            }`}
          />
          <span>
            {!health
              ? 'checking…'
              : health.status === 'UP' && health.llmConfigured
                ? 'llm ready'
                : health.llmConfigured
                  ? 'gateway degraded'
                  : 'llm not configured'}
          </span>
        </div>

        {isAdmin ? (
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={onOpenAdmin}>
            用户管理
          </button>
        ) : null}

        <div className="user-row">
          <div className="user-avatar">{username.slice(0, 1).toUpperCase()}</div>
          <div className="user-name">{username}</div>
          <button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 12 }} onClick={onLogout}>
            退出
          </button>
        </div>
      </div>
    </aside>
  )
}

function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '会话'
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}

function formatTime(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
