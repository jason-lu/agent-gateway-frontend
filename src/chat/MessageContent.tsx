import { Fragment, type ReactNode } from 'react'

/**
 * Minimal message renderer: fenced code blocks get a framed card, everything
 * else is pre-wrapped prose. Enough for LLM output without pulling in a
 * markdown dependency. An unterminated fence (still streaming) renders as code.
 */
export function MessageContent({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = parseBlocks(text)
  return (
    <div className="msg-text">
      {blocks.map((block, i) =>
        block.kind === 'code' ? (
          <div className="md-code" key={i}>
            <div className="md-code-head">
              <span>{block.lang || 'code'}</span>
            </div>
            <pre>
              <code>{block.content}</code>
            </pre>
          </div>
        ) : (
          <Fragment key={i}>
            {renderProse(block.content)}
            {streaming && i === blocks.length - 1 ? <span className="caret" /> : null}
          </Fragment>
        ),
      )}
      {streaming && blocks.length > 0 && blocks[blocks.length - 1].kind === 'code' ? (
        <span className="caret" />
      ) : null}
    </div>
  )
}

type Block = { kind: 'text'; content: string } | { kind: 'code'; lang: string; content: string }

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const fence = /```([^\n`]*)\n?/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = fence.exec(text)) !== null) {
    const head = text.slice(cursor, match.index)
    if (head) blocks.push({ kind: 'text', content: head })

    const lang = match[1].trim()
    const bodyStart = fence.lastIndex
    const close = text.indexOf('\n```', bodyStart)
    if (close === -1) {
      // fence still open — treat the rest of the buffer as code
      let body = text.slice(bodyStart)
      if (body.endsWith('\n')) body = body.slice(0, -1)
      blocks.push({ kind: 'code', lang, content: body })
      cursor = text.length
      fence.lastIndex = text.length
      break
    }
    blocks.push({ kind: 'code', lang, content: text.slice(bodyStart, close) })
    cursor = close + 4
    fence.lastIndex = cursor
  }

  if (cursor < text.length) blocks.push({ kind: 'text', content: text.slice(cursor) })
  return blocks
}

/** Wrap `inline code`, **bold** and *italic* spans; leave the rest as text. */
function renderProse(text: string): ReactNode[] {
  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code className="md-inline-code" key={i}>
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
