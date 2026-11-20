import { useState } from 'react'
import { api } from '../api/client'

/**
 * Forgot-password step two: exchange the mailed token for a new password. The
 * token usually arrives pre-filled via `?reset=<token>` on the app root; pasting
 * it by hand works too.
 */
export function ResetPasswordPage({
  initialToken,
  onShowLogin,
}: {
  initialToken: string | null
  onShowLogin: () => void
}) {
  const [token, setToken] = useState(initialToken ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const raw = token.trim()
    if (!raw || !password) return
    if (password.length < 8) {
      setError('密码至少 8 位')
      return
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.resetPassword({ token: raw, newPassword: password })
      setDone(true)
      window.history.replaceState({}, '', window.location.pathname)
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败，请重试')
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

          <h1>设置新密码</h1>
          {done ? (
            <>
              <p className="login-sub">
                密码已更新，所有登录会话已退出。请使用新密码登录。
              </p>
              <div className="login-actions">
                <button className="btn btn-primary" type="button" onClick={onShowLogin}>
                  去登录
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="login-sub">重置链接 30 分钟内有效，仅可使用一次。</p>

              {error && (
                <div className="error-banner" role="alert" style={{ marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <div className="login-field">
                <label className="field-label" htmlFor="reset-token">
                  重置验证码
                </label>
                <input
                  id="reset-token"
                  className="input mono"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                  autoFocus={!initialToken}
                  placeholder="邮件中的验证码"
                />
                {initialToken ? (
                  <div className="field-hint">已从重置链接自动填入。</div>
                ) : null}
              </div>

              <div className="login-field">
                <label className="field-label" htmlFor="reset-password">
                  新密码
                </label>
                <input
                  id="reset-password"
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="至少 8 位"
                />
              </div>

              <div className="login-field">
                <label className="field-label" htmlFor="reset-confirm">
                  确认新密码
                </label>
                <input
                  id="reset-confirm"
                  className="input"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="再输入一次"
                />
              </div>

              <div className="login-actions">
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? <span className="spinner" /> : null}
                  {busy ? '提交中…' : '更新密码'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={onShowLogin} disabled={busy}>
                  返回登录
                </button>
              </div>
            </>
          )}

          <div className="login-foot">POST /api/v1/auth/reset-password · REVOKES SESSIONS</div>
        </form>
      </div>

      <aside className="login-art" aria-hidden>
        <div className="login-art-grid" />
        <div className="login-art-top">
          <span className="login-art-tag">SET A NEW PASSWORD</span>
        </div>
        <p className="login-art-quote">
          一枚验证码
          <br />
          一个新密码
          <br />
          旧会话全下线。
        </p>
        <div className="login-art-meta">
          SINGLE-USE · 30 MINUTES
          <br />
          ALL SESSIONS REVOKED
        </div>
      </aside>
    </div>
  )
}
