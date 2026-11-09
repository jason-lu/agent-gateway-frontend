// Throwaway verification stub: an OpenAI-compatible upstream whose chat reply
// echoes the model name it was asked for, so the gateway→upstream routing of the
// chat-window model picker can be proven in a real browser. Also serves
// GET /v1/models so the admin form's "检测可用模型" works against it.
const http = require('node:http')

const MODELS = ['alpha-1', 'alpha-2', 'beta-1']

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0]
  if (req.method === 'GET' && (url.endsWith('/models') || url.endsWith('/v1/models'))) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ object: 'list', data: MODELS.map((id) => ({ id })) }))
    return
  }
  if (req.method !== 'POST' || !url.endsWith('/chat/completions')) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'not found' } }))
    return
  }
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    let body = {}
    try {
      body = JSON.parse(raw || '{}')
    } catch {
      /* ignore */
    }
    const reply = `已收到，本次回复来自模型 **${body.model || '(未指定)'}**。`
    if (body.stream !== true) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        id: 'chatcmpl-echo',
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
      }))
      return
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    const chunks = reply.match(/[\s\S]{1,6}/g) || []
    let i = 0
    const timer = setInterval(() => {
      if (i < chunks.length) {
        res.write(`data: ${JSON.stringify({
          id: 'chatcmpl-echo',
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: { content: chunks[i] }, finish_reason: null }],
        })}\n\n`)
        i++
      } else {
        res.write(`data: ${JSON.stringify({
          id: 'chatcmpl-echo',
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
        clearInterval(timer)
      }
    }, 30)
  })
})

server.listen(9191, '127.0.0.1', () => console.log('echo llm on 127.0.0.1:9191'))
