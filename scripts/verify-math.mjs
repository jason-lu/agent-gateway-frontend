// Throwaway verification stub: renders MessageContent with TeX math in every
// shape LLM replies actually use (inline `$…$`/`\(…\)`, display `$$…$$`/`\[…\]`
// one-line and multi-line, in headings/tables/lists/bold, plus currency and
// escaped-dollar false positives and an unclosed block) and checks the SSR
// output structurally. KaTeX is preloaded first so formulas render synchronously.
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const frontend = join(here, '..')
const outDir = join(frontend, 'output')
mkdirSync(outDir, { recursive: true })

const SAMPLE = `# 数学公式 $x^2$ 渲染检查

## 一、行内公式

质能方程 $E = mc^2$ 与分式 $\\frac{1}{2}$、下标 $\\alpha_i$。

括号写法 \\(a + b\\) 也应渲染，显示括号 \\[z\\] 同理。

## 二、独立公式

$$
E = mc^2
$$

$$a^2 + b^2 = c^2$$

\\[
\\int_0^1 x \\, dx = \\frac{1}{2}
\\]

## 三、表格与列表中的公式

| 符号 | 含义 |
|------|------|
| $\\pi$ | 圆周率 |
| $$\\sum_i x_i$$ | 求和 |

- 列表项 $x_1$ 与 **$x_2$**
- 代码 \`$x$\` 不应渲染

## 四、不应误判的情况

价格是 $5 与 $10，转义 \\$5 显示为 $5。

## 五、流式未闭合

$$
\\frac{1}{`

const entry = `
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MessageContent } from './src/chat/MessageContent'
import { loadKatex } from './src/chat/MathFormula'

loadKatex().then(() => {
  const body = renderToStaticMarkup(React.createElement(MessageContent, { text: SAMPLE_JSON }))
  process.stdout.write(body)
})
`.replace('SAMPLE_JSON', () => JSON.stringify(SAMPLE))

const built = await build({
  stdin: { contents: entry, resolveDir: frontend, loader: 'tsx', sourcefile: 'entry.tsx' },
  bundle: true,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  write: false,
  outfile: 'out.cjs',
})
const bundlePath = join(outDir, '.math-verify-out.cjs')
writeFileSync(bundlePath, built.outputFiles[0].text)
const body = execFileSync(process.execPath, [bundlePath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })

const css = readFileSync(join(frontend, 'src', 'styles.css'), 'utf8')
const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>MessageContent math check</title>
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
      ${body}
    </div>
  </article>
</div>
</body>
</html>`
const pagePath = join(outDir, 'math-sample.html')
writeFileSync(pagePath, page)
console.log('wrote', pagePath)
console.log('--- structure checks ---')
const katexCount = (body.match(/class="katex"/g) || []).length
const displayCount = (body.match(/class="katex-display"/g) || []).length
const checks = {
  'inline + display formulas rendered': katexCount >= 8,
  'display-mode blocks (3+)': displayCount >= 3,
  'heading math rendered': /<h1 class="md-h md-h1">[^]*?class="katex"/.test(body),
  'table cell math rendered': /<td[^>]*>[^]*?class="katex"/.test(body),
  'bold wraps math': /<strong>[^]*?class="katex"/.test(body),
  'inline code keeps literal $x$': /<code class="md-inline-code">\$x\$<\/code>/.test(body),
  'currency $5 / $10 stays text': body.includes('价格是 $5 与 $10'),
  'escaped \\$5 renders as $5': body.includes('转义 $5 显示为') && !body.includes('\\$5'),
  'unclosed math renders as raw block': /<div class="md-math-raw">[^]*?\\frac\{1\}\{/.test(body),
  'no raw inline dollar math left': !/质能方程 \$E = mc\$/.test(body),
}
let failed = 0
for (const [name, ok] of Object.entries(checks)) {
  console.log(ok ? 'PASS' : 'FAIL', '-', name)
  if (!ok) failed++
}
process.exit(failed ? 1 : 0)
