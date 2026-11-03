// Throwaway verification stub: renders MessageContent client-side with mermaid
// fences (valid / invalid / unclosed) and writes a self-contained HTML page for
// a visual check in a real browser — mermaid needs a DOM, so no SSR here.
import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const frontend = join(here, '..')
const outDir = join(frontend, 'output')
mkdirSync(outDir, { recursive: true })

const SAMPLE = `# Mermaid 渲染检查

## 一、流程图（应渲染为图表）

\`\`\`mermaid
flowchart TD
  A[用户提问] --> B{是否含 mermaid?}
  B -- 是 --> C[渲染图表]
  B -- 否 --> D[渲染代码卡]
  C --> E[完成]
  D --> E
\`\`\`

## 二、时序图（应渲染为图表）

\`\`\`mermaid
sequenceDiagram
  participant U as 用户
  participant F as 前端
  participant M as mermaid
  U->>F: 发送含图表的回答
  F->>M: render(code)
  M-->>F: svg
  F-->>U: 展示图表
\`\`\`

## 三、坏语法（应回退为代码卡）

\`\`\`mermaid
flowchart TD
  A[缺半个中括号 --> B
\`\`\`

## 四、普通代码块（不受影响）

\`\`\`ts
const x: number = 1
\`\`\`

## 五、未闭合的 mermaid（流式中，应显示代码卡）

\`\`\`mermaid
graph LR
  X -->`

const entry = `
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MessageContent } from './src/chat/MessageContent'
const root = createRoot(document.getElementById('root'))
root.render(React.createElement(MessageContent, { text: ${JSON.stringify(SAMPLE)}, streaming: true }))
`

const built = await build({
  stdin: { contents: entry, resolveDir: frontend, loader: 'tsx', sourcefile: 'entry.tsx' },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  write: false,
  outfile: 'mermaid-check.js',
  define: { 'process.env.NODE_ENV': '"production"' },
})

const css = readFileSync(join(frontend, 'src', 'styles.css'), 'utf8')
const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>Mermaid rendering check</title>
<style>${css}</style>
<style>
  body { background: var(--bg); }
  .check-wrap { max-width: var(--chat-max); margin: 24px auto; padding: 20px 24px;
    background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--r-lg); }
</style>
</head>
<body>
<div class="check-wrap">
  <article class="msg msg-assistant">
    <div class="msg-avatar">a</div>
    <div class="msg-body">
      <div class="msg-head"><span class="msg-author">Agent</span></div>
      <div id="root"></div>
    </div>
  </article>
</div>
<script>${built.outputFiles[0].text}</script>
</body>
</html>`

const pagePath = join(outDir, 'mermaid-check.html')
writeFileSync(pagePath, page)
console.log('wrote', pagePath)
