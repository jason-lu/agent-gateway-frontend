import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { SessionResponse } from '../api/types'
import { useIsAdmin } from '../auth/AuthContext'
import {
  buildJson,
  buildMarkdown,
  downloadTextFile,
  exportFilename,
  toExportSession,
  type ExportSession,
} from '../lib/export'

interface ExportMenuProps {
  /** Currently open conversation; null when nothing is selected. */
  session: SessionResponse | null
  sessions: SessionResponse[]
  /** Local title hints, so exports match the sidebar's names. */
  titles: Record<string, string>
}

type Format = 'json' | 'md'

/** Topbar export: download the transcript as Markdown (all users) or JSON (admin debug). */
export function ExportMenu({ session, sessions, titles }: ExportMenuProps) {
  const isAdmin = useIsAdmin()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function run(scope: 'session' | 'all', format: Format) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      // JSON is the debug dump (raw log: system prompts, summaries, tool traffic)
      // and is admin-only; Markdown is the clean transcript and uses /messages.
      const fetchMessages = (id: string) =>
        format === 'json' ? api.rawHistory(id) : api.history(id)
      let exportSessions: ExportSession[]
      let name: string
      if (scope === 'session') {
        if (!session) return
        const messages = await fetchMessages(session.id)
        exportSessions = [toExportSession(session, messages, titles[session.id])]
        // Same title chain as the document header — including the first-user-line
        // fallback — so the filename matches what the export says.
        name = exportSessions[0].title
      } else {
        // Sequential: a bulk export should not stampede the gateway.
        exportSessions = []
        for (const s of await api.listSessions()) {
          exportSessions.push(toExportSession(s, await fetchMessages(s.id), titles[s.id]))
        }
        name = '全部会话'
      }
      const content = format === 'json' ? buildJson(exportSessions) : buildMarkdown(exportSessions)
      downloadTextFile(
        exportFilename(scope, name, format),
        content,
        format === 'json' ? 'application/json' : 'text/markdown',
      )
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? `导出失败：${err.message}` : '导出失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        className="export-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={sessions.length === 0}
        title="导出聊天记录"
        onClick={() => {
          setError(null)
          setOpen((v) => !v)
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
        </svg>
        导出
      </button>

      {open ? (
        <div className="user-menu-pop" role="menu">
          <button
            className="user-menu-item"
            role="menuitem"
            disabled={busy || !session}
            onClick={() => void run('session', 'md')}
          >
            导出当前会话 · Markdown
          </button>
          {isAdmin ? (
            <button
              className="user-menu-item"
              role="menuitem"
              disabled={busy || !session}
              onClick={() => void run('session', 'json')}
            >
              导出当前会话 · JSON
            </button>
          ) : null}

          <div className="user-menu-sep" />

          <button
            className="user-menu-item"
            role="menuitem"
            disabled={busy || sessions.length === 0}
            onClick={() => void run('all', 'md')}
          >
            导出全部会话 · Markdown
          </button>
          {isAdmin ? (
            <button
              className="user-menu-item"
              role="menuitem"
              disabled={busy || sessions.length === 0}
              onClick={() => void run('all', 'json')}
            >
              导出全部会话 · JSON
            </button>
          ) : null}

          {busy || error ? (
            <div className={`export-menu-note${error ? ' error' : ''}`}>{error ?? '导出中…'}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
