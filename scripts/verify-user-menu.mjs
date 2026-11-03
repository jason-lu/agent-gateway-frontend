// Throwaway verification stub: renders the real UserMenu (admin + regular user)
// and the slimmed sidebar foot client-side, auto-opens both menus and writes a
// static HTML page for a visual check in a real browser.
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
import { UserMenu } from './src/layout/UserMenu'

const noop = () => {}
const clicked = []
const act = (name) => () => { clicked.push(name) }

function Panel({ label, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--faint)', margin: '0 0 8px' }}>{label}</div>
      {children}
    </section>
  )
}

function Topbar({ username, isAdmin }) {
  return (
    <div className="main" style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', overflow: 'visible' }}>
      <div className="topbar">
        <div className="topbar-title">示例会话</div>
        <div className="topbar-spacer" />
        {isAdmin ? (
          <div className="topbar-nav">
            <button className="active">对话</button>
            <button>用户</button>
          </div>
        ) : null}
        <UserMenu username={username} isAdmin={isAdmin}
          onChangePassword={act('change-password')} onOpenAdmin={act('open-admin')} onLogout={act('logout')} />
      </div>
    </div>
  )
}

function App() {
  return (
    <div>
      <Panel label="topbar · 管理员菜单展开">
        <div style={{ height: 240 }}><Topbar username="admin" isAdmin={true} /></div>
      </Panel>
      <Panel label="topbar · 普通用户菜单展开">
        <div style={{ height: 240 }}><Topbar username="alice" isAdmin={false} /></div>
      </Panel>
      <Panel label="sidebar-foot · 仅状态行">
        <aside className="sidebar" style={{ width: 264, border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)' }}>
          <div className="sidebar-foot">
            <div className="status-row">
              <span className="status-dot up" />
              <span>llm ready</span>
            </div>
          </div>
        </aside>
      </Panel>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
// Open both menus: real click on the first, synthetic click on the second so it
// does not trigger the first menu's outside-press close handler.
setTimeout(() => {
  const triggers = document.querySelectorAll('.user-menu-trigger')
  if (triggers[0]) triggers[0].click()
  if (triggers[1]) triggers[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
  window.__menuProbe = {
    menus: document.querySelectorAll('.user-menu-pop').length,
    items: [...document.querySelectorAll('.user-menu-item')].map((el) => el.textContent),
  }
}, 100)
`

const built = await build({
  stdin: { contents: entry, resolveDir: frontend, loader: 'tsx', sourcefile: 'entry.tsx' },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  write: false,
  outfile: 'user-menu-check.js',
  define: { 'process.env.NODE_ENV': '"production"' },
})

const css = readFileSync(join(frontend, 'src', 'styles.css'), 'utf8')
const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>User menu rendering check</title>
<style>${css}</style>
<style>
  body { background: var(--bg); }
  .check-wrap { max-width: 620px; margin: 24px auto; padding: 20px 24px;
    background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--r-lg); }
</style>
</head>
<body>
<div class="check-wrap">
  <div id="root"></div>
</div>
<script>${built.outputFiles[0].text}</script>
</body>
</html>`

const pagePath = join(outDir, 'user-menu-check.html')
writeFileSync(pagePath, page)
console.log('wrote', pagePath)
