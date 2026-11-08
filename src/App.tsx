import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from './api/client'
import type { HealthResponse, SessionResponse } from './api/types'
import { AdminPage } from './admin/AdminPage'
import { useAuth, useIsAdmin } from './auth/AuthContext'
import { LoginPage } from './auth/LoginPage'
import { ChatView } from './chat/ChatView'
import { Sidebar } from './layout/Sidebar'
import { UserMenu } from './layout/UserMenu'
import { SettingsDialog } from './settings/SettingsDialog'

const SELECTED_KEY = 'agent.selectedSession'
const TITLES_KEY = 'agent.sessionTitles'

export default function App() {
  const { user, logout } = useAuth()
  if (!user) return <LoginPage />
  return <Console username={user.username} onLogout={logout} />
}

function Console({ username, onLogout }: { username: string; onLogout: () => void }) {
  const isAdmin = useIsAdmin()
  const [sessions, setSessions] = useState<SessionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem(SELECTED_KEY))
  const [view, setView] = useState<'chat' | 'admin'>('chat')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [titles, setTitles] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(TITLES_KEY) ?? '{}') as Record<string, string>
    } catch {
      return {}
    }
  })
  const titlesRef = useRef(titles)
  titlesRef.current = titles

  const persistTitles = useCallback((updater: (prev: Record<string, string>) => Record<string, string>) => {
    setTitles((prev) => {
      const next = updater(prev)
      localStorage.setItem(TITLES_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // Session list
  const reloadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.listSessions()
      setSessions(list)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onLogout()
    } finally {
      setLoading(false)
    }
  }, [onLogout])

  useEffect(() => {
    void reloadSessions()
  }, [reloadSessions])

  // Keep the selection valid as the list changes.
  useEffect(() => {
    if (sessions.length === 0) {
      if (selectedId !== null) {
        setSelectedId(null)
        localStorage.removeItem(SELECTED_KEY)
      }
      return
    }
    if (!selectedId || !sessions.some((s) => s.id === selectedId)) {
      const first = sessions[0].id
      setSelectedId(first)
      localStorage.setItem(SELECTED_KEY, first)
    }
  }, [sessions, selectedId])

  // Health poll — cheap and public; drives the sidebar status dot.
  useEffect(() => {
    let alive = true
    const tick = () => {
      api
        .health()
        .then((h) => {
          if (alive) setHealth(h)
        })
        .catch(() => {
          if (alive) setHealth(null)
        })
    }
    tick()
    const timer = window.setInterval(tick, 30_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const selected = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? null,
    [sessions, selectedId],
  )

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    localStorage.setItem(SELECTED_KEY, id)
    setView('chat')
  }, [])

  const handleCreate = useCallback(
    async (systemPrompt?: string) => {
      const created = await api.createSession(systemPrompt ? { systemPrompt } : {})
      setSessions((prev) => [created, ...prev])
      setSelectedId(created.id)
      localStorage.setItem(SELECTED_KEY, created.id)
      setView('chat')
    },
    [],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await api.deleteSession(id)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          onLogout()
          return
        }
        return
      }
      setSessions((prev) => prev.filter((s) => s.id !== id))
      persistTitles((prev) => {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
      if (selectedId === id) {
        setSelectedId(null)
        localStorage.removeItem(SELECTED_KEY)
      }
    },
    [selectedId, onLogout, persistTitles],
  )

  const handleTitleHint = useCallback(
    (sessionId: string, hint: string) => {
      const title = hint.replace(/\s+/g, ' ').trim().slice(0, 28) || '未命名会话'
      if (titlesRef.current[sessionId] === title) return
      persistTitles((prev) => ({ ...prev, [sessionId]: title }))
    },
    [persistTitles],
  )

  const handleMessageCount = useCallback((sessionId: string, count: number) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, messageCount: count } : s)))
  }, [])

  return (
    <div className="shell">
      <Sidebar
        sessions={sessions}
        selectedId={view === 'chat' ? selectedId : null}
        titles={titles}
        health={health}
        busy={loading}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />

      <main className="main">
        <div className="topbar">
          <div className="topbar-title">
            {view === 'admin'
              ? '管理'
              : selected
                ? selected.title || titles[selected.id] || '新会话'
                : '未选择会话'}
          </div>
          <div className="topbar-spacer" />
          {isAdmin ? (
            <div className="topbar-nav">
              <button
                className={view === 'chat' ? 'active' : ''}
                onClick={() => setView('chat')}
              >
                对话
              </button>
              <button
                className={view === 'admin' ? 'active' : ''}
                onClick={() => setView('admin')}
              >
                管理
              </button>
            </div>
          ) : null}
          <UserMenu
            username={username}
            isAdmin={isAdmin}
            onOpenSettings={() => setShowSettings(true)}
            onOpenAdmin={() => setView('admin')}
            onLogout={onLogout}
          />
        </div>

        {view === 'admin' ? (
          <AdminPage />
        ) : selected ? (
          <ChatView
            key={selected.id}
            session={selected}
            onTitleHint={handleTitleHint}
            onMessageCount={handleMessageCount}
          />
        ) : (
          <div className="center-fill">
            <div style={{ textAlign: 'center', maxWidth: 320 }}>
              <div className="chat-empty-mark" style={{ margin: '0 auto 14px' }}>
                a
              </div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>还没有会话</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.7 }}>
                在左侧点击「新建会话」创建一个对话，然后在这里开始聊天。
              </div>
            </div>
          </div>
        )}
      </main>

      {showSettings ? <SettingsDialog onClose={() => setShowSettings(false)} /> : null}
    </div>
  )
}
