import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import { streamChat, type SseEvent } from '../api/sse'
import type { HistoryMessage, SessionResponse } from '../api/types'
import { MessageContent } from './MessageContent'

interface UiMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  error?: boolean
}

interface ChatViewProps {
  session: SessionResponse
  onTitleHint: (sessionId: string, title: string) => void
  onMessageCount: (sessionId: string, count: number) => void
}

export function ChatView({ session, onTitleHint, onMessageCount }: ChatViewProps) {
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reload history whenever the selected session changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setMessages([])
    setInput('')
    abortRef.current?.abort()
    abortRef.current = null
    setSending(false)

    api
      .history(session.id)
      .then((history: HistoryMessage[]) => {
        if (cancelled) return
        setMessages(history.map((m) => ({ role: m.role, content: m.content })))
        const firstUser = history.find((m) => m.role === 'user')
        if (firstUser) onTitleHint(session.id, firstUser.content)
        onMessageCount(session.id, history.length)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : '加载历史失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // onTitleHint / onMessageCount are stable callbacks from the parent.
  }, [session.id, onTitleHint, onMessageCount])

  // Keep the transcript pinned to the bottom while streaming.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const send = useCallback(async () => {
    const content = input.trim()
    if (!content || sending) return

    setInput('')
    setSending(true)
    setLoadError(null)

    setMessages((prev) => [
      ...prev,
      { role: 'user', content },
      { role: 'assistant', content: '', streaming: true },
    ])

    const controller = new AbortController()
    abortRef.current = controller

    let acc = ''
    const patchAssistant = (patch: Partial<UiMessage>) =>
      setMessages((prev) => {
        const next = [...prev]
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === 'assistant') {
            next[i] = { ...next[i], ...patch }
            break
          }
        }
        return next
      })

    const handleEvent = (event: SseEvent) => {
      if (event.type === 'delta') {
        acc += event.text
        patchAssistant({ content: acc })
      } else if (event.type === 'done') {
        acc = event.reply
        patchAssistant({ content: acc, streaming: false })
      } else {
        patchAssistant({ content: event.message, streaming: false, error: true })
      }
    }

    try {
      await streamChat(session.id, content, handleEvent, controller.signal)
      // Stream ended without an explicit `done` — keep whatever we accumulated.
      patchAssistant({ streaming: false, content: acc })
      onMessageCount(session.id, messages.length + 2)
    } catch (err) {
      if (controller.signal.aborted) {
        patchAssistant({ streaming: false, content: acc || '（已停止生成）' })
      } else if (acc) {
        // Connection dropped mid-stream: keep what already rendered.
        patchAssistant({ content: acc, streaming: false })
      } else {
        const message = err instanceof Error ? err.message : '发送失败'
        patchAssistant({ content: message, streaming: false, error: true })
      }
    } finally {
      abortRef.current = null
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [input, sending, session.id, messages.length, onMessageCount])

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <>
      <div className="chat-scroll" ref={scrollRef}>
        {loading ? (
          <div className="center-fill">
            <span className="spinner" /> 加载会话历史…
          </div>
        ) : loadError && messages.length === 0 ? (
          <div className="center-fill">
            <div className="error-banner">{loadError}</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-mark">a</div>
            <h2>开始一段对话</h2>
            <p>
              这条会话还没有任何消息。下面输入你的第一句话，回复会以流式方式实时渲染。
            </p>
          </div>
        ) : (
          <div className="chat-inner">
            {messages.map((m, i) => (
              <article className={`msg msg-${m.role}${m.error ? ' msg-error' : ''}`} key={i}>
                <div className="msg-avatar">{m.role === 'user' ? '我' : 'a'}</div>
                <div className="msg-body">
                  <div className="msg-head">
                    <span className="msg-author">{m.role === 'user' ? '你' : 'Agent'}</span>
                    {m.streaming ? <span className="msg-time">正在生成</span> : null}
                  </div>
                  {m.role === 'assistant' ? (
                    <MessageContent text={m.content} streaming={m.streaming} />
                  ) : (
                    <div className="msg-text">{m.content}</div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="composer-wrap">
        <div className="composer">
          {loadError && messages.length > 0 ? (
            <div className="error-banner" style={{ marginBottom: 10 }}>
              {loadError}
            </div>
          ) : null}
          <div className="composer-box">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="输入消息，Enter 发送，Shift+Enter 换行"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading}
            />
            <div className="composer-bar">
              <span className="composer-hint">
                {session.messageCount > 0 ? `${session.messageCount} 条历史` : '新会话'} ·{' '}
                <span className="mono">{session.id.slice(0, 8)}</span>
              </span>
              {sending ? (
                <button className="btn btn-danger" onClick={stop}>
                  停止生成
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => void send()}
                  disabled={loading || !input.trim()}
                >
                  发送
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/** Shared 401 handler: an expired token should drop the user back to login. */
export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401
}
