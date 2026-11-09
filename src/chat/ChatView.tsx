import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import { streamChat, type SseEvent } from '../api/sse'
import type { HistoryMessage, LlmModelChoice, SessionResponse } from '../api/types'
import { MessageContent } from './MessageContent'
import { AuthImage } from './AuthImage'

interface UiMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  streaming?: boolean
  error?: boolean
}

/** A staged image: local preview name plus the data URL sent to the gateway. */
interface Attachment {
  id: string
  name: string
  dataUrl: string
}

/** Kept in sync with the gateway's per-message image cap. */
const MAX_ATTACHMENTS = 10

/** Roughly the gateway's per-image size limit (base64 inflates by ~1/3). */
const MAX_IMAGE_BYTES = 18 * 1024 * 1024

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
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [sending, setSending] = useState(false)
  const [models, setModels] = useState<{ option: LlmModelChoice; label: string }[] | null>(null)
  const [choice, setChoice] = useState<LlmModelChoice | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // The model picker: what the deployment offers plus this account's saved choice.
  useEffect(() => {
    let cancelled = false
    api
      .llmModelCatalog()
      .then((catalog) => {
        if (cancelled) return
        setModels(
          catalog.models.map((option) => ({
            option: { providerId: option.providerId, model: option.model },
            label: `${option.providerName} / ${option.model}`,
          })),
        )
        setChoice(catalog.selected ?? catalog.defaultChoice ?? null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setModelError(err instanceof Error ? `模型列表加载失败：${err.message}` : '模型列表加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Reload history whenever the selected session changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setMessages([])
    setInput('')
    setAttachments([])
    abortRef.current?.abort()
    abortRef.current = null
    setSending(false)

    api
      .history(session.id)
      .then((history: HistoryMessage[]) => {
        if (cancelled) return
        setMessages(
          history.map((m) => ({
            role: m.role,
            content: m.content,
            images: m.images?.length ? m.images : undefined,
          })),
        )
        const firstUser = history.find((m) => m.role === 'user')
        if (firstUser && (firstUser.content || firstUser.images?.length)) {
          onTitleHint(session.id, firstUser.content || '[图片]')
        }
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

  // Grow the composer with the draft so multi-line input stays visible.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [input])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  /** Stages image files (picker / paste) as data URLs ready to send. */
  const addFiles = useCallback(
    (files: Iterable<File>) => {
      const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'))
      if (!incoming.length) return
      const room = MAX_ATTACHMENTS - attachments.length
      if (room <= 0) {
        setLoadError(`一次最多附带 ${MAX_ATTACHMENTS} 张图片`)
        return
      }
      const accepted = incoming.slice(0, room)
      if (accepted.length < incoming.length) {
        setLoadError(`一次最多附带 ${MAX_ATTACHMENTS} 张图片`)
      }
      for (const file of accepted) {
        if (file.size > MAX_IMAGE_BYTES) {
          setLoadError(`图片「${file.name}」过大，未添加`)
          continue
        }
        const reader = new FileReader()
        reader.onload = () => {
          setAttachments((prev) =>
            prev.length >= MAX_ATTACHMENTS
              ? prev
              : [
                  ...prev,
                  {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    name: file.name,
                    dataUrl: String(reader.result),
                  },
                ],
          )
        }
        reader.readAsDataURL(file)
      }
    },
    [attachments.length],
  )

  const send = useCallback(async () => {
    const content = input.trim()
    const images = attachments.map((a) => a.dataUrl)
    if ((!content && images.length === 0) || sending) return

    setInput('')
    setAttachments([])
    setSending(true)
    setLoadError(null)

    setMessages((prev) => [
      ...prev,
      { role: 'user', content, images: images.length ? images : undefined },
      { role: 'assistant', content: '', streaming: true },
    ])

    const controller = new AbortController()
    abortRef.current = controller

    let acc = ''
    // A done/error event carries the verdict for the turn; the post-stream patch
    // must not overwrite it with a bare accumulator afterwards.
    let settled = false
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
        settled = true
        acc = event.reply
        patchAssistant({ content: acc, streaming: false })
      } else {
        settled = true
        // Always surface the failure: a partial answer says why it stopped; with
        // no answer at all the error itself replaces the blank bubble.
        patchAssistant(
          acc
            ? { content: `${acc}\n\n> ⚠️ ${event.message}`, streaming: false }
            : { content: `请求失败：${event.message}`, streaming: false, error: true },
        )
      }
    }

    try {
      await streamChat(
        session.id,
        content,
        images.length ? images : undefined,
        choice?.providerId,
        choice?.model,
        handleEvent,
        controller.signal,
      )
      // Stream ended without a done/error event — keep whatever we accumulated.
      if (!settled) {
        patchAssistant({ streaming: false, content: acc || '（连接中断，未收到回复）', error: !acc })
      }
      onMessageCount(session.id, messages.length + 2)
    } catch (err) {
      if (controller.signal.aborted) {
        patchAssistant({ streaming: false, content: acc || '（已停止生成）' })
      } else if (acc) {
        // Connection dropped mid-stream: keep what already rendered, say why it stopped.
        patchAssistant({ content: `${acc}\n\n> ⚠️ 连接中断，回答可能不完整`, streaming: false })
      } else {
        const message = err instanceof Error ? err.message : '发送失败'
        patchAssistant({ content: `请求失败：${message}`, streaming: false, error: true })
      }
    } finally {
      abortRef.current = null
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [input, attachments, sending, session.id, messages.length, onMessageCount, choice])

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  /** Remembers the picked model server-side so it follows the account. */
  function onModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const picked = models?.find((entry) => optionKey(entry.option) === e.target.value)
    if (!picked) return
    setChoice(picked.option)
    setModelError(null)
    api.setMyLlmModel(picked.option).catch((err: unknown) => {
      setModelError(err instanceof Error ? `模型选择未保存：${err.message}` : '模型选择未保存')
    })
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)
    if (files.length) {
      e.preventDefault()
      addFiles(files)
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
                    <div className="msg-text">
                      {m.images?.length ? (
                        <div className="msg-images">
                          {m.images.map((src, j) => (
                            <AuthImage className="msg-image" key={j} src={src} />
                          ))}
                        </div>
                      ) : null}
                      {m.content}
                    </div>
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
          {modelError ? (
            <div className="error-banner" style={{ marginBottom: 10 }}>
              {modelError}
            </div>
          ) : null}
          <div className="composer-box">
            {attachments.length > 0 ? (
              <div className="composer-attachments">
                {attachments.map((a) => (
                  <div className="composer-attachment" key={a.id}>
                    <img src={a.dataUrl} alt={a.name} />
                    <button
                      type="button"
                      className="composer-attachment-remove"
                      aria-label="移除图片"
                      onClick={() => removeAttachment(a.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="输入消息，Enter 发送，Shift+Enter 换行；可添加或粘贴图片"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              disabled={loading}
            />
            <div className="composer-bar">
              <div className="composer-bar-left">
                <button
                  type="button"
                  className="btn btn-ghost composer-icon-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || sending}
                  aria-label="添加图片"
                  title="添加图片"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                {models && models.length > 0 && choice ? (
                  <select
                    className="input model-picker"
                    aria-label="选择模型"
                    title="选择模型"
                    value={optionKey(choice)}
                    onChange={onModelChange}
                    disabled={loading || sending}
                  >
                    {models.map((entry) => (
                      <option key={optionKey(entry.option)} value={optionKey(entry.option)}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              {sending ? (
                <button
                  className="btn btn-danger composer-send"
                  onClick={stop}
                  aria-label="停止生成"
                  title="停止生成"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  className="btn btn-primary composer-send"
                  onClick={() => void send()}
                  disabled={loading || (!input.trim() && attachments.length === 0)}
                  aria-label="发送"
                  title="发送"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files)
                e.target.value = ''
              }}
            />
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

/** Composite key for the model picker; the pair is what identifies a choice. */
function optionKey(choice: LlmModelChoice): string {
  return `${choice.providerId}|${choice.model}`
}
