import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'

const KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/

/**
 * Per-user tool credentials: GH_TOKEN and friends, injected only into this
 * user's exec runs (and materialized to .secrets/<KEY> inside the user's
 * workspace for file-based tools such as gcloud --key-file). Values are stored
 * server-side and never echoed back — only the mask placeholder is.
 */
export function ToolEnvSection() {
  const [entries, setEntries] = useState<Record<string, string> | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [okMessage, setOkMessage] = useState<string | null>(null)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setEntries(await api.listToolEnv())
      setListError(null)
    } catch (err) {
      setListError(err instanceof Error ? err.message : '加载失败')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function save() {
    const key = newKey.trim()
    const value = newValue.trim()
    setFormError(null)
    setOkMessage(null)
    if (!KEY_PATTERN.test(key)) {
      setFormError('键名需为大写字母、数字和下划线，且以字母开头，例如 GH_TOKEN')
      return
    }
    if (!value) {
      setFormError('值不能为空')
      return
    }
    setSaving(true)
    try {
      await api.saveToolEnv(key, value)
      setNewKey('')
      setNewValue('')
      setOkMessage(key + ' 已保存，只在你的命令环境里生效')
      await reload()
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove(key: string) {
    setFormError(null)
    setOkMessage(null)
    try {
      await api.deleteToolEnv(key)
      setDeleteArmed(null)
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="settings-pane">
      <p className="dialog-sub">
        这里绑定的凭据（如 GH_TOKEN、GCLOUD_SA_KEY）只注入到你自己账号的命令执行环境，
        不会出现在其他人的会话里，也永远不会回显到页面或聊天。值同时会写入你工作区的
        .secrets/&lt;键名&gt; 文件，方便 gcloud 这类需要密钥文件的工具直接使用。
      </p>

      {listError ? <div className="error-banner">{listError}</div> : null}
      {formError ? <div className="error-banner">{formError}</div> : null}
      {okMessage ? <div className="ok-banner">{okMessage}</div> : null}

      <div className="dialog-field">
        <label className="field-label" htmlFor="toolenv-key">
          键名
        </label>
        <input
          id="toolenv-key"
          className="input"
          value={newKey}
          maxLength={64}
          placeholder="GH_TOKEN"
          onChange={(e) => setNewKey(e.target.value.toUpperCase())}
        />
      </div>

      <div className="dialog-field">
        <label className="field-label" htmlFor="toolenv-value">
          值
        </label>
        <input
          id="toolenv-value"
          className="input"
          type="password"
          value={newValue}
          maxLength={16384}
          placeholder="粘贴 token 或密钥 JSON"
          onChange={(e) => setNewValue(e.target.value)}
        />
      </div>

      <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
        保存凭据
      </button>

      <div className="mcp-list">
        {entries === null ? (
          <div className="mcp-empty">加载中…</div>
        ) : Object.keys(entries).length === 0 ? (
          <div className="mcp-empty">
            还没有绑定凭据。绑定 GH_TOKEN 后，你在会话里让助手执行 gh 命令时用的就是你自己的
            GitHub 身份。
          </div>
        ) : (
          Object.keys(entries)
            .sort()
            .map((key) => (
              <div className="mcp-row" key={key}>
                <div className="mcp-row-main">
                  <div className="mcp-row-name">{key}</div>
                  <div className="mcp-row-detail">{entries[key]}</div>
                </div>
                <div className="mcp-row-actions">
                  {deleteArmed === key ? (
                    <button className="btn btn-ghost" onClick={() => void remove(key)}>
                      确认删除
                    </button>
                  ) : (
                    <button className="btn btn-ghost" onClick={() => setDeleteArmed(key)}>
                      删除
                    </button>
                  )}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  )
}
