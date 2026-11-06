// Throwaway verification stub: renders the real ChatView composer with a mocked
// history API so the add-image / send buttons and the auto-growing textarea can
// be checked visually and interactively in a real browser.
import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const frontend = join(here, '..')
const outDir = join(frontend, 'output')
mkdirSync(outDir, { recursive: true })

const entry = `
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ChatView } from './src/chat/ChatView'

// Mock the history call so ChatView mounts into its empty state.
const origFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input.url
  if (url.includes('/messages') && (!init || !init.method || init.method === 'GET')) {
    return Promise.resolve(new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
  }
  return origFetch(input, init)
}

function App() {
  return (
    <div className="main" style={{ height: 560, border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <ChatView
        session={{ id: 's1', title: '示例会话', createdAt: '', updatedAt: '', messageCount: 0 }}
        onTitleHint={() => {}}
        onMessageCount={() => {}}
      />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
`

const built = await build({
  stdin: { contents: entry, resolveDir: frontend, loader: 'tsx', sourcefile: 'entry.tsx' },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  write: false,
  outfile: 'composer-check.js',
  define: { 'process.env.NODE_ENV': '"production"' },
})

const css = readFileSync(join(frontend, 'src', 'styles.css'), 'utf8')
const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>Composer rendering check</title>
<style>${css}</style>
<style>
  body { background: var(--bg); margin: 0; }
  .check-wrap { max-width: 760px; margin: 24px auto; padding: 0; }
</style>
</head>
<body>
<div class="check-wrap">
  <div id="root"></div>
</div>
<script>${built.outputFiles[0].text}</script>
</body>
</html>`

const pagePath = join(outDir, 'composer-check.html')
writeFileSync(pagePath, page)
console.log('wrote', pagePath)
