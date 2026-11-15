import { getToken } from '../api/client'

export type AsrServerEvent =
  | { type: 'ready' }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'error'; message: string }
  | { type: 'ended' }

export interface AsrStreamHandlers {
  onEvent: (event: AsrServerEvent) => void
  /** Transport closed (clean or not). Fires at most once per connect(). */
  onClose: () => void
}

/**
 * Client for the gateway's streaming ASR WebSocket. Audio goes out as binary
 * PCM16/16 kHz frames; results come back as JSON text frames where `partial`
 * carries the full draft (wholesale replacement) and `final` the full result.
 */
export class AsrStreamClient {
  private ws: WebSocket | null = null
  private closed = false

  connect(language: string, handlers: AsrStreamHandlers): void {
    const token = getToken()
    if (!token) {
      handlers.onEvent({ type: 'error', message: '登录已过期，请重新登录' })
      handlers.onClose()
      return
    }
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${scheme}//${location.host}/api/v1/asr/stream?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    this.ws = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'start', language }))
    }
    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return
      let payload: unknown
      try {
        payload = JSON.parse(event.data)
      } catch {
        return
      }
      const data = payload as Record<string, unknown>
      if (data.type === 'ready') handlers.onEvent({ type: 'ready' })
      else if (data.type === 'partial' && typeof data.text === 'string')
        handlers.onEvent({ type: 'partial', text: data.text })
      else if (data.type === 'final' && typeof data.text === 'string')
        handlers.onEvent({ type: 'final', text: data.text })
      else if (data.type === 'error')
        handlers.onEvent({
          type: 'error',
          message: typeof data.message === 'string' ? data.message : '语音识别出错',
        })
      else if (data.type === 'ended') handlers.onEvent({ type: 'ended' })
    }
    ws.onclose = () => {
      if (this.closed) return
      this.closed = true
      handlers.onClose()
    }
  }

  sendAudio(pcm: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(pcm)
  }

  /** Asks the server to flush and finish; it answers with final + ended. */
  finish(): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'stop' }))
  }

  close(): void {
    this.closed = true
    this.ws?.close()
    this.ws = null
  }
}
