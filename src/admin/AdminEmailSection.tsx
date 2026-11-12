import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import { SECRET_MASK } from '../api/types'
import type { EmailSettingsResponse } from '../api/types'

interface FormState {
  host: string
  port: string
  username: string
  /** The typed password; blank means "keep the stored one". */
  password: string
  fromAddress: string
  useSsl: boolean
}

/**
 * Outbound SMTP account used for invite mails. Defaults match Aliyun
 * enterprise mail (smtp.qiye.aliyun.com, implicit SSL on 465); the password
 * is masked and round-trips as SECRET_MASK = keep stored.
 */
export function AdminEmailSection() {
  const [form, setForm] = useState<FormState | null>(null)
  const [hasStoredPassword, setHasStoredPassword] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)
  const [testHint, setTestHint] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const settings = await api.adminEmailSettings()
      setForm(toForm(settings))
      setHasStoredPassword(settings.password === SECRET_MASK)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '加载失败')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function save() {
    if (!form) return
    const host = form.host.trim()
    const username = form.username.trim()
    const port = Number(form.port)
    if (!host) {
      setFormError('请填写服务器地址')
      return
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setFormError('端口需在 1–65535 之间')
      return
    }
    if (!username) {
      setFormError('请填写邮箱用户名')
      return
    }
    setSaving(true)
    setFormError(null)
    setSavedHint(null)
    try {
      const settings = await api.updateAdminEmailSettings({
        host,
        port,
        username,
        password: form.password || SECRET_MASK,
        fromAddress: form.fromAddress.trim(),
        useSsl: form.useSsl,
      })
      setForm(toForm(settings))
      setHasStoredPassword(settings.password === SECRET_MASK)
      setSavedHint('已保存')
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    const to = testTo.trim()
    if (!to) {
      setTestHint('请填写测试收件地址')
      return
    }
    setTesting(true)
    setTestHint(null)
    try {
      await api.testAdminEmail(to)
      setTestHint(`测试邮件已发送至 ${to}`)
    } catch (err) {
      setTestHint(err instanceof Error ? `发送失败：${err.message}` : '发送失败')
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="llm-settings">
      <h2>邮箱设置</h2>
      <p className="admin-sub">
        用于发送注册邀请码的 SMTP 发信账号。默认按阿里云企业邮箱配置（smtp.qiye.aliyun.com · 465 · SSL），
        填写账号密码后建议先发一封测试邮件确认可用。密码加密存储，页面上只显示掩码。
      </p>

      {loadError ? <div className="error-banner">{loadError}</div> : null}

      {form ? (
        <div className="mcp-editor">
          {formError ? <div className="error-banner">{formError}</div> : null}

          <div className="dialog-field">
            <label className="field-label" htmlFor="email-host">
              服务器地址
            </label>
            <input
              id="email-host"
              className="input"
              value={form.host}
              placeholder="smtp.qiye.aliyun.com"
              onChange={(e) => setForm({ ...form, host: e.target.value })}
            />
          </div>

          <div className="dialog-field">
            <label className="field-label" htmlFor="email-port">
              服务器端口
            </label>
            <input
              id="email-port"
              className="input"
              type="number"
              min={1}
              max={65535}
              value={form.port}
              placeholder="465"
              onChange={(e) => setForm({ ...form, port: e.target.value })}
            />
            <div className="llm-clear-note">SSL 加密（推荐）：465；非加密：25。</div>
          </div>

          <div className="dialog-field">
            <label className="field-label" htmlFor="email-username">
              邮箱用户名
            </label>
            <input
              id="email-username"
              className="input"
              value={form.username}
              placeholder="如 admin@example.com"
              autoComplete="off"
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div className="dialog-field">
            <label className="field-label" htmlFor="email-password">
              邮箱密码
            </label>
            <input
              id="email-password"
              className="input"
              type="password"
              value={form.password}
              placeholder={hasStoredPassword ? '已设置（留空保持不变）' : '必填'}
              autoComplete="new-password"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div className="dialog-field">
            <label className="field-label" htmlFor="email-from">
              发件人地址
            </label>
            <input
              id="email-from"
              className="input"
              value={form.fromAddress}
              placeholder="留空则使用邮箱用户名"
              onChange={(e) => setForm({ ...form, fromAddress: e.target.value })}
            />
          </div>

          <div className="dialog-field">
            <label className="field-label">
              <input
                type="checkbox"
                checked={form.useSsl}
                onChange={(e) => setForm({ ...form, useSsl: e.target.checked })}
              />{' '}
              SSL 加密（推荐）
            </label>
          </div>

          <div className="dialog-actions">
            <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? <span className="spinner" /> : null}
              保存
            </button>
            {savedHint ? <span className="llm-clear-note">{savedHint}</span> : null}
          </div>

          <div className="dialog-field" style={{ marginTop: 18 }}>
            <label className="field-label" htmlFor="email-test-to">
              发送测试邮件
            </label>
            <div className="kv-row">
              <input
                id="email-test-to"
                className="input"
                type="email"
                value={testTo}
                placeholder="收件地址"
                onChange={(e) => setTestTo(e.target.value)}
              />
              <button className="btn btn-ghost" onClick={() => void sendTest()} disabled={testing}>
                {testing ? <span className="spinner" /> : null}
                发送测试
              </button>
            </div>
            {testHint ? <div className="llm-clear-note">{testHint}</div> : null}
          </div>
        </div>
      ) : loadError ? null : (
        <div className="mcp-empty">加载中…</div>
      )}
    </section>
  )
}

function toForm(settings: EmailSettingsResponse): FormState {
  return {
    host: settings.host,
    port: String(settings.port),
    username: settings.username,
    password: '',
    fromAddress: settings.fromAddress,
    useSsl: settings.useSsl,
  }
}
