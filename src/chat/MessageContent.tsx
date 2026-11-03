import { Fragment, type ReactNode } from 'react'
import { MermaidDiagram } from './MermaidDiagram'

/**
 * Renders LLM replies: fenced code blocks get a framed card (```mermaid fences
 * become real diagrams once closed); the prose around them is parsed as
 * markdown (headings, tables, lists, quotes, rules, links and inline
 * code/bold/italic). Deliberately dependency-free — a small line-based parser
 * covers what LLM answers actually emit. An unterminated fence (still
 * streaming) renders as code.
 */
export function MessageContent({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = parseBlocks(text)
  const caret = streaming ? <span className="caret" /> : null
  const nodes: ReactNode[] = []

  blocks.forEach((block, i) => {
    const tail = i === blocks.length - 1 ? caret : null
    if (block.kind === 'code') {
      const card = <CodeCard lang={block.lang} content={block.content} />
      nodes.push(
        block.lang.toLowerCase() === 'mermaid' && block.closed ? (
          <MermaidDiagram key={`c${i}`} code={block.content} fallback={card} />
        ) : (
          <Fragment key={`c${i}`}>{card}</Fragment>
        ),
      )
      if (tail) nodes.push(<Fragment key={`t${i}`}>{tail}</Fragment>)
      return
    }

    const mdBlocks = parseMd(block.content)
    if (mdBlocks.length === 0) {
      if (tail) nodes.push(<Fragment key={`t${i}`}>{tail}</Fragment>)
      return
    }
    mdBlocks.forEach((mb, j) => {
      nodes.push(renderMdBlock(mb, `${i}-${j}`, j === mdBlocks.length - 1 ? tail : null))
    })
  })

  return <div className="msg-text">{nodes}</div>
}

function CodeCard({ lang, content }: { lang: string; content: string }) {
  return (
    <div className="md-code">
      <div className="md-code-head">
        <span>{lang || 'code'}</span>
      </div>
      <pre>
        <code>{content}</code>
      </pre>
    </div>
  )
}

type FenceBlock =
  | { kind: 'text'; content: string }
  | { kind: 'code'; lang: string; content: string; closed: boolean }
type MdBlock =
  | { kind: 'p'; lines: string[] }
  | { kind: 'h'; level: number; content: string }
  | { kind: 'hr' }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'list'; items: ListItem[] }
  | { kind: 'table'; head: string[]; align: ColAlign[]; rows: string[][] }
type ListItem = { ordered: boolean; content: string; children: ListItem[] }
type ColAlign = 'left' | 'center' | 'right' | null

function parseBlocks(text: string): FenceBlock[] {
  const blocks: FenceBlock[] = []
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
      blocks.push({ kind: 'code', lang, content: body, closed: false })
      cursor = text.length
      fence.lastIndex = text.length
      break
    }
    blocks.push({ kind: 'code', lang, content: text.slice(bodyStart, close), closed: true })
    cursor = close + 4
    fence.lastIndex = cursor
  }

  if (cursor < text.length) blocks.push({ kind: 'text', content: text.slice(cursor) })
  return blocks
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const HR_RE = /^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/
const QUOTE_RE = /^\s*>\s?(.*)$/
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/

function isTableSep(line: string): boolean {
  return line.includes('|') && line.includes('-') && /^[\s|:-]+$/.test(line)
}

function startsBlock(lines: string[], i: number): boolean {
  const line = lines[i]
  return (
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line) ||
    (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))
  )
}

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((cell) => cell.trim())
}

function parseAlign(sepLine: string, cols: number): ColAlign[] {
  const cells = splitRow(sepLine)
  const out: ColAlign[] = []
  for (let i = 0; i < cols; i++) {
    const c = cells[i] ?? ''
    if (c.startsWith(':') && c.endsWith(':')) out.push('center')
    else if (c.endsWith(':')) out.push('right')
    else if (c.startsWith(':')) out.push('left')
    else out.push(null)
  }
  return out
}

function parseListBlock(lines: string[], start: number): { items: ListItem[]; next: number } {
  const root: ListItem[] = []
  const stack: { indent: number; items: ListItem[] }[] = [{ indent: -1, items: root }]
  let lastItem: ListItem | null = null
  let i = start

  while (i < lines.length) {
    const line = lines[i]
    const m = LIST_RE.exec(line)
    if (m) {
      const indent = m[1].replace(/\t/g, '    ').length
      const ordered = /^\d/.test(m[2])
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
      const item: ListItem = { ordered, content: m[3].trim(), children: [] }
      stack[stack.length - 1].items.push(item)
      stack.push({ indent, items: item.children })
      lastItem = item
      i++
      continue
    }

    if (!line.trim()) {
      // blank line keeps the list alive only if another item follows
      let j = i + 1
      while (j < lines.length && !lines[j].trim()) j++
      if (j < lines.length && LIST_RE.test(lines[j])) {
        i = j
        continue
      }
      break
    }

    if (startsBlock(lines, i)) break

    // continuation of the current item (indented or lazy wrap)
    if (lastItem) {
      lastItem.content += '\n' + line.trim()
      i++
      continue
    }
    break
  }
  return { items: root, next: i }
}

function parseMd(text: string): MdBlock[] {
  const lines = text.split(/\r?\n/)
  const blocks: MdBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }

    const h = HEADING_RE.exec(line)
    if (h) {
      blocks.push({ kind: 'h', level: h[1].length, content: h[2].trim() })
      i++
      continue
    }

    if (HR_RE.test(line)) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = splitRow(line)
      const align = parseAlign(lines[i + 1], head.length)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(splitRow(lines[i]))
        i++
      }
      blocks.push({ kind: 'table', head, align, rows })
      continue
    }

    if (QUOTE_RE.test(line)) {
      const qlines: string[] = []
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        qlines.push(lines[i].replace(QUOTE_RE, '$1'))
        i++
      }
      blocks.push({ kind: 'quote', lines: qlines })
      continue
    }

    if (LIST_RE.test(line)) {
      const { items, next } = parseListBlock(lines, i)
      blocks.push({ kind: 'list', items })
      i = next
      continue
    }

    const plines: string[] = []
    while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) {
      plines.push(lines[i])
      i++
    }
    blocks.push({ kind: 'p', lines: plines })
  }
  return blocks
}

function renderMdBlock(block: MdBlock, key: string, tail: ReactNode): ReactNode {
  switch (block.kind) {
    case 'p':
      return (
        <p className="md-p" key={key}>
          {renderLines(block.lines)}
          {tail}
        </p>
      )
    case 'h': {
      const level = Math.min(6, Math.max(1, block.level))
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      return (
        <Tag className={`md-h md-h${level}`} key={key}>
          {renderProse(block.content)}
          {tail}
        </Tag>
      )
    }
    case 'hr':
      return (
        <Fragment key={key}>
          <hr className="md-hr" />
          {tail}
        </Fragment>
      )
    case 'quote':
      return (
        <blockquote className="md-quote" key={key}>
          {renderLines(block.lines)}
          {tail}
        </blockquote>
      )
    case 'list':
      return renderList(block.items, key, tail)
    case 'table':
      return (
        <Fragment key={key}>
          <div className="md-table-wrap">
            <table className="md-table">
              <thead>
                <tr>
                  {block.head.map((cell, ci) => (
                    <th key={ci} style={alignStyle(block.align[ci])}>
                      {renderProse(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri}>
                    {block.head.map((_, ci) => (
                      <td key={ci} style={alignStyle(block.align[ci])}>
                        {renderProse(row[ci] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tail}
        </Fragment>
      )
  }
}

function alignStyle(align: ColAlign): { textAlign: 'center' | 'right' } | undefined {
  if (align === 'center') return { textAlign: 'center' }
  if (align === 'right') return { textAlign: 'right' }
  return undefined
}

/** Renders one markdown list level; the streaming tail descends to the last leaf. */
function renderList(items: ListItem[], key: string, tail: ReactNode): ReactNode {
  const ordered = items[0]?.ordered ?? false
  const inner = items.map((item, i) => {
    const childTail = i === items.length - 1 ? tail : null
    return (
      <li className="md-li" key={i}>
        {renderProse(item.content)}
        {item.children.length > 0 ? renderList(item.children, `${key}-${i}`, childTail) : childTail}
      </li>
    )
  })
  return ordered ? (
    <ol className="md-list md-list-ol" key={key}>
      {inner}
    </ol>
  ) : (
    <ul className="md-list md-list-ul" key={key}>
      {inner}
    </ul>
  )
}

/** Joins paragraph/quote lines with <br/>, rendering inline markdown per line. */
function renderLines(lines: string[]): ReactNode[] {
  const out: ReactNode[] = []
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`b${i}`} />)
    out.push(<Fragment key={`l${i}`}>{renderProse(line)}</Fragment>)
  })
  return out
}

/** Wrap `inline code`, **bold**, *italic* and [links](url) spans; rest as text. */
function renderProse(text: string): ReactNode[] {
  const parts = text.split(/(\[[^\]\n]+\]\([^)\n]+\)|`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
  return parts.map((part, i) => {
    if (!part) return null
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
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (link) {
      const href = link[2]
      if (/^(https?:\/\/|mailto:)/i.test(href)) {
        return (
          <a key={i} href={href} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        )
      }
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
