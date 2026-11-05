import { fetchWithAuth } from './client'

export type SseEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; reply: string }
  | { type: 'error'; message: string }

/**
 * The gateway streams chat over a POST with a JSON body, so the browser's native
 * EventSource (GET only) cannot be used. Read the response body as a stream and
 * parse the SSE framing by hand.
 */
export async function streamChat(
  sessionId: string,
  content: string,
  images: string[] | undefined,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetchWithAuth(`/api/v1/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ content, images }),
    signal,
  })

  if (!response.ok || !response.body) {
    let message = `流式请求失败（${response.status}）`
    try {
      const body = await response.json()
      if (typeof body?.message === 'string' && body.message) message = body.message
    } catch {
      // keep the generic message
    }
    throw new Error(message)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false

  const emitBlock = (block: string) => {
    let event = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue // SSE comment / keep-alive
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
    }
    if (dataLines.length === 0) return
    const raw = dataLines.join('\n')
    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      return
    }
    const data = payload as Record<string, unknown>
    if (event === 'delta' && typeof data.text === 'string') {
      onEvent({ type: 'delta', text: data.text })
    } else if (event === 'done' && typeof data.reply === 'string') {
      finished = true
      onEvent({ type: 'done', reply: data.reply })
    } else if (event === 'error') {
      finished = true
      onEvent({
        type: 'error',
        message: typeof data.message === 'string' ? data.message : '流式响应出错',
      })
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // An SSE block is terminated by a blank line. A trailing \r is tolerated.
      let sep: number
      while ((sep = findBlockEnd(buffer)) >= 0) {
        const block = buffer.slice(0, sep)
        buffer = buffer.slice(sep + findBlockEndLen(buffer, sep))
        if (block.trim()) emitBlock(block)
      }
    }
    buffer += decoder.decode()
    if (buffer.trim()) emitBlock(buffer)
  } catch (err) {
    // The gateway closes the SSE connection abruptly after the last event
    // (its async dispatch tears the response down). Everything the server sent
    // has already been parsed by that point, so a terminal `done`/`error` makes
    // the drop a non-event; only an early cut is worth reporting.
    if (!finished) throw err
  } finally {
    reader.releaseLock()
  }
}

/** Index of the blank-line separator that ends an SSE block, or -1. */
function findBlockEnd(buffer: string): number {
  const lf = buffer.indexOf('\n\n')
  const crlf = buffer.indexOf('\r\n\r\n')
  if (lf < 0) return crlf
  if (crlf < 0) return lf
  return Math.min(lf, crlf)
}

function findBlockEndLen(buffer: string, sep: number): number {
  return buffer.startsWith('\r\n\r\n', sep) ? 4 : 2
}
