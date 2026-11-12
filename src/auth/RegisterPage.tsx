import { useState } from 'react'
import { useAuth } from './AuthContext'

/** Invite-based registration: the code is consumed exactly once, then auto-login. */
export function RegisterPage({ onShowLogin }: { onShowLogin: () => void }) {
  const { register } = useAuth()
  const [inviteCode, setInviteCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = inviteCode.trim()
    const name = username.trim()
    if (!code || !name || !password) return
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
      await register(code, name, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请重试')
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

          <h1>使用邀请码注册</h1>
          <p className="login-sub">邀请码由管理员生成并通过邮件发送，使用一次后即失效。</p>

          {error && (
            <div className="error-banner" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div className="login-field">
            <label className="field-label" htmlFor="invite-code">
              邀请码
            </label>
            <input
              id="invite-code"
              className="input"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoComplete="off"
              autoFocus
              placeholder="如 K7M2QX9P"
            />
          </div>

          <div className="login-field">
            <label className="field-label" htmlFor="register-username">
              用户名
            </label>
            <input
              id="register-username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="2–64 个字符"
            />
          </div>

          <div className="login-field">
            <label className="field-label" htmlFor="register-password">
              密码
            </label>
            <input
              id="register-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="至少 8 位"
            />
          </div>

          <div className="login-field">
            <label className="field-label" htmlFor="register-confirm">
              确认密码
            </label>
            <input
              id="register-confirm"
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
              {busy ? '注册中…' : '注册并登录'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={onShowLogin} disabled={busy}>
              返回登录
            </button>
          </div>

          <div className="login-foot">POST /api/v1/auth/register · INVITE CODE</div>
        </form>
      </div>

      <aside className="login-art" aria-hidden>
        <div className="login-art-grid" />
        <div className="login-art-top">
          <span className="login-art-tag">INVITE-ONLY REGISTRATION</span>
        </div>
        <p className="login-art-quote">
          一枚邀请码
          <br />
          一个新账号
          <br />
          即刻开聊。
        </p>
        <div className="login-art-meta">
          SMTP · 邀请码一次性消费
          <br />
          JWT · POSTGRESQL
        </div>
      </aside>
    </div>
  )
}
