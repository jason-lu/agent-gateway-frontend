// Throwaway verification stub: renders MessageContent with a representative
// markdown answer and writes a static HTML page (styles inlined) for a visual check.
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const frontend = join(here, '..')
const outDir = join(frontend, 'output')
mkdirSync(outDir, { recursive: true })

const SAMPLE = `# LLM —— 大语言模型（Large Language Model）

## 一、基本定义

LLM（Large Language Model）即大语言模型，是基于深度学习技术构建的人工智能模型，能够理解和生成人类语言。它通过在海量文本数据上进行训练，学习语言的语法、语义、知识和推理能力。

---

## 二、核心特点

| 特点 | 说明 |
|------|------|
| 大规模参数 | 通常拥有数十亿到数千亿个参数（如 GPT-4 据称超过 1 万亿参数） |
| 海量数据训练 | 基于互联网文本、书籍、代码等大规模语料库 |
| 通用能力 | 一个模型可以执行翻译、写作、问答、编程等多种任务 |
| 上下文理解 | 能够理解长文本的上下文关系 |
| 涌现能力 | 当规模达到一定程度时，表现出训练目标之外的新能力 |

---

## 三、技术原理（简述）

\`\`\`code
输入文本 → 分词(Tokenization) → 嵌入(Embedding)
    → Transformer架构（注意力机制） → 预测下一个Token → 输出文本
\`\`\`

1. Transformer 架构：LLM 的核心架构（2017年由 Google 提出）
2. 自回归预测：逐个预测下一个词/字符
3. 预训练 + 微调：
 - 预训练（Pre-training）：在大规模无标注文本上学习语言规律
 - 微调/对齐（Fine-tuning/Alignment）：通过 RLHF 等方法使模型更符合人类期望

---

## 四、代表性 LLM

| 模型 | 公司 | 特点 |
|------|------|------|
| GPT-4 / ChatGPT | OpenAI | 最具影响力的 LLM 之一 |
| Claude | Anthropic | 注重安全性和有用性 |
| Gemini | Google | 多模态能力 |
| LLaMA | Meta | 开源系列 |
| DeepSeek | 深度求索 | 开源，推理能力强 |
| Qwen（通义千问） | 阿里巴巴 | 中文能力突出 |
| 文心一言 | 百度 | 中文生态 |

---

## 五、应用场景

- 💬 对话/问答：智能客服、聊天助手
- ✍️ 内容创作：写文章、翻译、总结
- 💻 代码生成：辅助编程（如 [GitHub Copilot](https://github.com/features/copilot)）
- 📊 数据分析：理解和处理数据
- 🎓 教育辅助：解题、辅导
- 🔍 信息检索：知识问答

---

## 六、局限性

- ⚠️ 幻觉问题：可能生成看似合理但错误的内容
- ⚠️ 知识截止：训练数据有时间限制
- ⚠️ 推理能力有限：复杂逻辑推理仍有不足
- ⚠️ 计算成本高：训练和推理需要大量算力

---

> 一句话总结：LLM 就是通过海量数据训练出的"超级语言模型"，它能像人类一样理解和生成文字，是当前 AI 领域最核心的技术之一。`

const entry = `
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MessageContent } from './src/chat/MessageContent'
const main = renderToStaticMarkup(React.createElement(MessageContent, { text: SAMPLE_JSON }))
const inline = renderToStaticMarkup(React.createElement(MessageContent, { text: '支持 \`code\`、**加粗**、*斜体* 的段落。' }))
const streaming = renderToStaticMarkup(React.createElement(MessageContent, { text: '## 标题\\n\\n正在输出的段落', streaming: true }))
process.stdout.write(main + '\\n<!--INLINE-->' + inline + '\\n<!--STREAMING-->' + streaming)
`.replace('SAMPLE_JSON', JSON.stringify(SAMPLE))

const built = await build({
  stdin: { contents: entry, resolveDir: frontend, loader: 'tsx', sourcefile: 'entry.tsx' },
  bundle: true,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  write: false,
  outfile: 'out.cjs',
})
const bundlePath = join(outDir, '.md-verify-out.cjs')
writeFileSync(bundlePath, built.outputFiles[0].text)
const output = execFileSync(process.execPath, [bundlePath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
const [body = '', rest = ''] = output.split('<!--INLINE-->')
const [inline = '', streaming = ''] = rest.split('<!--STREAMING-->')

const css = readFileSync(join(frontend, 'src', 'styles.css'), 'utf8')
const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>MessageContent markdown check</title>
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
const pagePath = join(outDir, 'md-sample.html')
writeFileSync(pagePath, page)
console.log('wrote', pagePath)
console.log('--- structure checks ---')
const checks = {
  'h1 heading': /<h1 class="md-h md-h1">LLM/.test(body),
  'h2 heading': /<h2 class="md-h md-h2">/.test(body),
  'hr count = 6': (body.match(/<hr class="md-hr"\/>/g) || []).length === 6,
  'table count = 2': (body.match(/<table class="md-table">/g) || []).length === 2,
  'th cells = 5': (body.match(/<th[ >]/g) || []).length === 5,
  'td cells = 31': (body.match(/<td[ >]/g) || []).length === 31,
  'ordered list': /<ol class="md-list md-list-ol">/.test(body),
  'unordered list': /<ul class="md-list md-list-ul">/.test(body),
  'nested list': /<li class="md-li">[^]*?<ul class="md-list md-list-ul">/.test(body),
  'blockquote': /<blockquote class="md-quote">/.test(body),
  'code card': /<div class="md-code">/.test(body) && /<span>code<\/span>/.test(body),
  'inline code + bold + italic': /<code class="md-inline-code">code<\/code>/.test(inline) && /<strong>加粗<\/strong>/.test(inline) && /<em>斜体<\/em>/.test(inline),
  'streaming caret': /class="caret"/.test(streaming),
  'link sanitized': /<a [^>]*href="https:\/\/github\.com\/features\/copilot"/.test(body),
  'no raw pipe table': !/\| 特点 \| 说明 \|/.test(body),
  'no raw heading marker': !body.includes('# LLM'),
  'no raw quote marker': !body.includes('&gt; 一句话总结'),
}
let failed = 0
for (const [name, ok] of Object.entries(checks)) {
  console.log(ok ? 'PASS' : 'FAIL', '-', name)
  if (!ok) failed++
}
process.exit(failed ? 1 : 0)
