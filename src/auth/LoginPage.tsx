import { useState } from 'react'
import { useAuth } from './AuthContext'

export function LoginPage({ onShowRegister }: { onShowRegister?: () => void }) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-form-side">
        <form className="login-card" onSubmit={onSubmit}>
          <div className="login-mark">
            <div className="login-mark-badge">a</div>
            <div className="login-mark-text">
              agent <span>/ gateway</span>
            </div>
          </div>

          <h1>登录到控制台</h1>
          <p className="login-sub">使用你的账号继续对话会话。</p>

          {error && (
            <div className="error-banner" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div className="login-field">
            <label className="field-label" htmlFor="username">
              用户名
            </label>
            <input
              id="username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              placeholder="admin"
            />
          </div>

          <div className="login-field">
            <label className="field-label" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          <div className="login-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              {busy ? '登录中…' : '登录'}
            </button>
            {onShowRegister ? (
              <button className="btn btn-ghost" type="button" onClick={onShowRegister} disabled={busy}>
                使用邀请码注册
              </button>
            ) : null}
          </div>

          <div className="login-foot">POST /api/v1/auth/login · JWT BEARER</div>
        </form>
      </div>

      <aside className="login-art" aria-hidden>
        <div className="login-art-grid" />
        <div className="login-art-top">
          <span className="login-art-tag">OPENAI-STYLE CHAT/COMPLETIONS</span>
        </div>
        <p className="login-art-quote">
          多会话
          <br />
          流式对话
          <br />
          一处网关。
        </p>
        <div className="login-art-meta">
          SSE · JWT · POSTGRESQL
          <br />
          MEMORY-COMPRESSED TURNS
        </div>
      </aside>
    </div>
  )
}
