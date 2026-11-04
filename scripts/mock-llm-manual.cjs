// Throwaway stub for user-manual screenshots: OpenAI-style /chat/completions
// (JSON + SSE). Alternates two canned replies — the first is a markdown-rich
// answer (headings, table, code, mermaid, list, quote) so the manual can show
// the renderer; the second is a short follow-up.
const http = require('node:http')

const REPLY_A = [
  '# LLM —— 大语言模型简介',
  '\n\n大语言模型（Large Language Model）是基于深度学习构建的语言模型，通过海量文本训练获得语言理解与生成能力。',
  '\n\n## 核心特点\n\n| 特点 | 说明 |\n|------|------|\n| 大规模参数 | 通常数十亿到数千亿参数 |\n| 海量数据 | 基于互联网文本、书籍、代码等语料 |\n| 通用能力 | 翻译、写作、问答、编程等多种任务 |\n| 上下文理解 | 理解长文本的上下文关系 |\n',
  '\n处理流程如下：\n\n```text\n输入文本 → 分词 → 嵌入 → Transformer（注意力机制）→ 预测下一 Token → 输出\n```\n',
  '\n会话式架构可以概括为：\n\n```mermaid\nflowchart LR\n    U[用户消息] --> G[Agent 网关]\n    G --> M[记忆压缩]\n    M --> L[LLM 上游]\n    L -->|SSE 流式| G\n    G -->|SSE 流式| U\n```\n',
  '\n## 使用建议\n\n1. 从明确、具体的提问开始\n2. 提供必要的上下文与约束\n3. 对结果保持审慎，注意幻觉问题\n',
  '\n> 一句话总结：LLM 是通过海量数据训练出的语言模型，是当前 AI 应用的核心组件。',
].join('')

const REPLY_B = [
  '好的，**记忆压缩**的作用是让长会话的请求体保持有界：',
  '\n\n- 历史超过 `max-messages`（默认 20 条）时，最旧的轮次会被折叠成一条摘要',
  '\n- 最近 `keep-messages`（默认 8 条）轮次始终原样保留',
  '\n- 摘要增量更新，成本不会随会话变长而增长',
  '\n\n这样即使聊得很久，每次请求依然轻量。',
].join('')

const REPLY_C = [
  '这里有几个实用建议：',
  '\n\n1. 从明确、具体的提问开始',
  '\n2. 提供必要的上下文与约束条件',
  '\n3. 对生成结果保持审慎，注意幻觉问题',
  '\n\n祝使用愉快！',
].join('')

const REPLIES = [REPLY_A, REPLY_B]
let turn = 0

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
    // Dispatch by user message content so screenshots are deterministic:
    // "记忆压缩" -> short memory reply, "建议" -> suggestions, else rich LLM intro.
    const lastUser = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && m.role === 'user')
      .map((m) => String(m.content || ''))
      .pop() || ''
    const reply = lastUser.includes('记忆压缩')
      ? REPLY_B
      : lastUser.includes('建议')
        ? REPLY_C
        : REPLIES[0]
    turn++
    const stream = body.stream === true
    if (!stream) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          id: 'chatcmpl-manual',
          object: 'chat.completion',
          choices: [
            { index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' },
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
    const chunks = reply.match(/[\s\S]{1,14}/g) || []
    let i = 0
    const timer = setInterval(() => {
      if (i < chunks.length) {
        res.write(
          `data: ${JSON.stringify({
            id: 'chatcmpl-manual',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { content: chunks[i] }, finish_reason: null }],
          })}\n\n`,
        )
        i++
      } else {
        res.write(
          `data: ${JSON.stringify({
            id: 'chatcmpl-manual',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          })}\n\n`,
        )
        res.write('data: [DONE]\n\n')
        res.end()
        clearInterval(timer)
      }
    }, 150)
  })
})

server.listen(9191, '127.0.0.1', () => console.log('mock llm (manual) on 127.0.0.1:9191'))
