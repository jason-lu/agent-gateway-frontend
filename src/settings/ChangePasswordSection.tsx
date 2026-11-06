import { useState } from 'react'
import { api, ApiError } from '../api/client'

/** Password change form; lives inside the settings panel. */
export function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!currentPassword || !newPassword || !confirm) {
      setError('请填写所有密码字段')
      return
    }
    if (newPassword.length < 8) {
      setError('新密码至少 8 个字符')
      return
    }
    if (newPassword !== confirm) {
      setError('两次输入的新密码不一致')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.changePassword({ currentPassword, newPassword })
      setDone(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : '修改失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="settings-pane">
      <p className="dialog-sub">修改后，下次登录使用新密码。新密码至少 8 个字符。当前登录状态不受影响。</p>

      {done ? <div className="ok-banner">密码已修改。</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="dialog-field">
        <label className="field-label" htmlFor="current-password">
          当前密码
        </label>
        <input
          id="current-password"
          className="input"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <div className="dialog-field">
        <label className="field-label" htmlFor="new-password">
          新密码
        </label>
        <input
          id="new-password"
          className="input"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <div className="dialog-field">
        <label className="field-label" htmlFor="confirm-password">
          确认新密码
        </label>
        <input
          id="confirm-password"
          className="input"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <div className="dialog-actions">
        <button className="btn btn-primary" onClick={() => void submit()} disabled={submitting}>
          {submitting ? <span className="spinner" /> : null}
          确认修改
        </button>
      </div>
    </div>
  )
}
