// Throwaway verification stub: speaks the OpenAI /chat/completions contract
// (JSON + SSE) so the real gateway can be exercised without an upstream key.
const http = require('node:http')

const REPLY = [
  '你好！这是一段**流式**回复，用来验证网关到前端的整条链路。',
  '\n\n下面是一段代码示例：\n\n',
  '```ts\n',
  'const greeting = "hello, agent gateway"\n',
  'console.log(greeting)\n',
  '```\n',
  '\n如果你能看到文字逐段出现、代码块有独立边框、末尾光标消失，说明流式渲染工作正常。',
].join('')

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.endsWith('/chat/completions')) {
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
    const stream = body.stream === true
    if (!stream) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          id: 'chatcmpl-mock',
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: REPLY },
              finish_reason: 'stop',
            },
          ],
        }),
      )
      return
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    const chunks = REPLY.match(/[\s\S]{1,12}/g) || []
    let i = 0
    const timer = setInterval(() => {
      if (i < chunks.length) {
        res.write(
          `data: ${JSON.stringify({
            id: 'chatcmpl-mock',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { content: chunks[i] }, finish_reason: null }],
          })}\n\n`,
        )
        i++
      } else {
        res.write(
          `data: ${JSON.stringify({
            id: 'chatcmpl-mock',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          })}\n\n`,
        )
        res.write('data: [DONE]\n\n')
        res.end()
        clearInterval(timer)
      }
    }, 250)
  })
})

server.listen(9191, '127.0.0.1', () => console.log('mock llm on 127.0.0.1:9191'))
