import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'

interface ChangePasswordDialogProps {
  onClose: () => void
}

export function ChangePasswordDialog({ onClose }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : '修改失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="修改密码" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <h2>密码已修改</h2>
            <p className="dialog-sub">下次登录请使用新密码。当前登录状态不受影响。</p>
            <div className="dialog-actions">
              <button className="btn btn-primary" onClick={onClose}>
                完成
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>修改密码</h2>
            <p className="dialog-sub">修改后，下次登录使用新密码。新密码至少 8 个字符。</p>

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
              <button className="btn" onClick={onClose} disabled={submitting}>
                取消
              </button>
              <button className="btn btn-primary" onClick={() => void submit()} disabled={submitting}>
                {submitting ? <span className="spinner" /> : null}
                确认修改
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
