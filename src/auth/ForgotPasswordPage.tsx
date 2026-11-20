import { useState } from 'react'
import { api } from '../api/client'

/** Forgot-password step one: mail a reset token to the account's bound address. */
export function ForgotPasswordPage({ onShowLogin }: { onShowLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = username.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      await api.forgotPassword({ username: name })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败，请重试')
    } finally {
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

          <h1>重置密码</h1>
          {sent ? (
            <>
              <p className="login-sub">
                如果该账号存在且已绑定邮箱，重置邮件已发送。请查收邮件，按提示设置新密码。
                重置链接 30 分钟内有效，仅可使用一次。
              </p>
              <div className="login-actions">
                <button className="btn btn-primary" type="button" onClick={onShowLogin}>
                  返回登录
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="login-sub">
                输入用户名，我们会向该账号绑定的邮箱发送重置链接。绑定邮箱来自注册时使用的邀请码。
              </p>

              {error && (
                <div className="error-banner" role="alert" style={{ marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <div className="login-field">
                <label className="field-label" htmlFor="forgot-username">
                  用户名
                </label>
                <input
                  id="forgot-username"
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  placeholder="你的登录用户名"
                />
              </div>

              <div className="login-actions">
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? <span className="spinner" /> : null}
                  {busy ? '发送中…' : '发送重置邮件'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={onShowLogin} disabled={busy}>
                  返回登录
                </button>
              </div>
            </>
          )}

          <div className="login-foot">POST /api/v1/auth/forgot-password · SINGLE-USE TOKEN</div>
        </form>
      </div>

      <aside className="login-art" aria-hidden>
        <div className="login-art-grid" />
        <div className="login-art-top">
          <span className="login-art-tag">PASSWORD RECOVERY</span>
        </div>
        <p className="login-art-quote">
          忘了密码
          <br />
          邮件找回
          <br />
          三十分钟。
        </p>
        <div className="login-art-meta">
          SMTP · SINGLE-USE RESET TOKEN
          <br />
          SESSIONS REVOKED ON RESET
        </div>
      </aside>
    </div>
  )
}
