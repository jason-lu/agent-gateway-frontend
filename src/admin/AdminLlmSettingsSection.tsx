import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import { SECRET_MASK } from '../api/types'
import type { AdminLlmSettingsResponse, LlmSettingsSource } from '../api/types'

const SOURCE_LABEL: Record<LlmSettingsSource, string> = {
  admin: '管理员配置',
  env: '环境变量',
  none: '未配置',
}

/**
 * Deployment-level LLM upstream overrides. Admin values win per field; a field
 * without an override falls back to the environment (LLM_BASE_URL / LLM_API_KEY /
 * LLM_MODEL). Changes apply to the next turn without a restart.
 */
export function AdminLlmSettingsSection() {
  const [settings, setSettings] = useState<AdminLlmSettingsResponse | null>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetArmed, setResetArmed] = useState(false)

  const reload = useCallback(async () => {
    try {
      const data = await api.adminLlmSettings()
      setSettings(data)
      setBaseUrl(data.baseUrl ?? '')
      setModel(data.model ?? '')
      setApiKey('')
      setClearKey(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const updated = await api.updateAdminLlmSettings({
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        // Blank with a stored key round-trips the mask ("keep"); typed text replaces.
        apiKey: clearKey ? '' : apiKey === '' && settings?.apiKey ? SECRET_MASK : apiKey.trim(),
      })
      setSettings(updated)
      setBaseUrl(updated.baseUrl ?? '')
      setModel(updated.model ?? '')
      setApiKey('')
      setClearKey(false)
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function resetAll() {
    setSaving(true)
    setError(null)
    try {
      await api.resetAdminLlmSettings()
      await reload()
      setResetArmed(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="llm-settings">
      <h2>LLM 上游</h2>
      <p className="admin-sub">
        管理员配置优先，未配置的字段回退到环境变量（<span className="mono">LLM_BASE_URL</span> /{' '}
        <span className="mono">LLM_API_KEY</span> / <span className="mono">LLM_MODEL</span>）。保存后立即生效。
      </p>

      {error ? <div className="error-banner">{error}</div> : null}

      {settings ? (
        <div className="llm-effective">
          <span className="llm-effective-label">当前生效</span>
          <span className="llm-effective-item">
            <span className="mono">{settings.effectiveBaseUrl ?? '未配置'}</span>
            <span className={`chip${settings.baseUrlSource === 'admin' ? ' chip-accent' : ''}`}>
              {SOURCE_LABEL[settings.baseUrlSource]}
            </span>
          </span>
          <span className="llm-effective-item">
            <span className="mono">{settings.effectiveModel ?? '未配置'}</span>
            <span className={`chip${settings.modelSource === 'admin' ? ' chip-accent' : ''}`}>
              {SOURCE_LABEL[settings.modelSource]}
            </span>
          </span>
          <span className="llm-effective-item">
            <span className="mono">api-key {settings.apiKeySource === 'none' ? '未配置' : '已配置'}</span>
            <span className={`chip${settings.apiKeySource === 'admin' ? ' chip-accent' : ''}`}>
              {SOURCE_LABEL[settings.apiKeySource]}
            </span>
          </span>
        </div>
      ) : null}

      <div className="dialog-field">
        <label className="field-label" htmlFor="llm-base-url">
          Base URL
        </label>
        <input
          id="llm-base-url"
          className="input"
          type="text"
          placeholder="留空则使用环境变量"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>

      <div className="dialog-field">
        <label className="field-label" htmlFor="llm-api-key">
          API Key
        </label>
        <input
          id="llm-api-key"
          className="input"
          type="password"
          placeholder={settings?.apiKey ? '已设置（留空保持不变）' : '留空则使用环境变量'}
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value)
            setClearKey(false)
          }}
          autoComplete="new-password"
        />
        {settings?.apiKey && !clearKey ? (
          <button className="btn btn-ghost llm-clear-key" onClick={() => setClearKey(true)}>
            清除已存的 API Key
          </button>
        ) : null}
        {clearKey ? <div className="llm-clear-note">保存后将清除管理员 API Key，回退到环境变量。</div> : null}
      </div>

      <div className="dialog-field">
        <label className="field-label" htmlFor="llm-model">
          模型名称
        </label>
        <input
          id="llm-model"
          className="input"
          type="text"
          placeholder="留空则使用环境变量"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      </div>

      <div className="dialog-actions">
        <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
          {saving ? <span className="spinner" /> : null}
          保存
        </button>
        {resetArmed ? (
          <>
            <button className="btn btn-danger" onClick={() => void resetAll()} disabled={saving}>
              确认恢复环境变量配置？
            </button>
            <button className="btn btn-ghost" onClick={() => setResetArmed(false)} disabled={saving}>
              取消
            </button>
          </>
        ) : (
          <button className="btn btn-ghost" onClick={() => setResetArmed(true)} disabled={saving}>
            恢复环境变量配置
          </button>
        )}
      </div>
    </section>
  )
}
