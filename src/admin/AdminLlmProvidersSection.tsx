import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import { SECRET_MASK } from '../api/types'
import type { LlmProviderResponse } from '../api/types'

interface EditorState {
  mode: 'create' | 'edit'
  id: string | null
  name: string
  baseUrl: string
  /** The typed key; blank on edit means "keep the stored one". */
  apiKey: string
  models: string[]
  defaultModel: string
  newModel: string
}

/**
 * Deployment-level LLM providers: each row is a connection (base URL + API key)
 * and the models it offers. Exactly one is the primary — the default users fall
 * back to — and it cannot be deleted until another one is promoted.
 */
export function AdminLlmProvidersSection() {
  const [providers, setProviders] = useState<LlmProviderResponse[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [modelHint, setModelHint] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setProviders(await api.adminLlmProviders())
      setListError(null)
    } catch (err) {
      setListError(err instanceof Error ? err.message : '加载失败')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  function startCreate() {
    setFormError(null)
    setModelHint(null)
    setEditor({
      mode: 'create',
      id: null,
      name: '',
      baseUrl: '',
      apiKey: '',
      models: [],
      defaultModel: '',
      newModel: '',
    })
  }

  function startEdit(provider: LlmProviderResponse) {
    setFormError(null)
    setModelHint(null)
    setEditor({
      mode: 'edit',
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: '',
      models: [...provider.models],
      defaultModel: provider.defaultModel,
      newModel: '',
    })
  }

  function setModels(models: string[], defaultModel: string) {
    setEditor((prev) => (prev ? { ...prev, models, defaultModel } : prev))
  }

  /** Asks the upstream for its model IDs with the connection the form holds right now. */
  async function detectModels() {
    if (!editor) return
    const key = editor.apiKey.trim()
    if (!key && editor.mode === 'create') {
      setModelHint('请先填写 API Key，再检测可用模型')
      return
    }
    setDetecting(true)
    setModelHint(null)
    try {
      const data = await api.listAdminLlmModels({
        id: editor.id,
        baseUrl: editor.baseUrl.trim(),
        apiKey: key || SECRET_MASK,
      })
      const merged = [...editor.models]
      for (const name of data.models) {
        if (!merged.includes(name)) merged.push(name)
      }
      if (merged.length === 0) {
        setModelHint('上游未返回模型列表，请手动添加模型名称')
      } else {
        setModels(merged, editor.defaultModel || merged[0])
      }
    } catch (err) {
      setModelHint(err instanceof Error ? `无法获取模型列表：${err.message}` : '无法获取模型列表')
    } finally {
      setDetecting(false)
    }
  }

  function addModel() {
    if (!editor) return
    const name = editor.newModel.trim()
    if (!name || editor.models.includes(name)) {
      setEditor({ ...editor, newModel: '' })
      return
    }
    setEditor({
      ...editor,
      models: [...editor.models, name],
      defaultModel: editor.defaultModel || name,
      newModel: '',
    })
  }

  function removeModel(name: string) {
    if (!editor) return
    const models = editor.models.filter((model) => model !== name)
    const defaultModel =
      editor.defaultModel === name ? (models[0] ?? '') : editor.defaultModel
    setModels(models, defaultModel)
  }

  async function save() {
    if (!editor) return
    const name = editor.name.trim()
    const baseUrl = editor.baseUrl.trim()
    const apiKey = editor.apiKey.trim()
    if (!name) {
      setFormError('请填写名称')
      return
    }
    if (!baseUrl) {
      setFormError('请填写 Base URL')
      return
    }
    if (!apiKey && editor.mode === 'create') {
      setFormError('请填写 API Key')
      return
    }
    if (editor.models.length === 0) {
      setFormError('请至少添加一个模型')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const body = {
        name,
        baseUrl,
        apiKey: apiKey || SECRET_MASK,
        models: editor.models,
        defaultModel: editor.defaultModel || editor.models[0],
      }
      if (editor.mode === 'create') await api.createAdminLlmProvider(body)
      else await api.updateAdminLlmProvider(editor.id as string, body)
      setEditor(null)
      await reload()
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function promote(provider: LlmProviderResponse) {
    try {
      await api.promoteAdminLlmProvider(provider.id)
      await reload()
    } catch (err) {
      setListError(err instanceof Error ? err.message : '操作失败')
    }
  }

  async function remove(provider: LlmProviderResponse) {
    try {
      await api.deleteAdminLlmProvider(provider.id)
      setDeleteArmed(null)
      if (editor?.mode === 'edit' && editor.id === provider.id) setEditor(null)
      await reload()
    } catch (err) {
      setListError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <section className="llm-settings">
      <h2>LLM 供应商</h2>
      <p className="admin-sub">
        每条记录是一个上游连接（Base URL + API Key）及其可选模型，用户在聊天窗口里自由挑选具体的模型。
        带「默认」标记的是主供应商（primary）——至少保留一个，且不能删除；想删它，请先把其他供应商设为默认。
        修改保存后立即生效，无需重启。
      </p>

      {listError ? <div className="error-banner">{listError}</div> : null}

      <div className="mcp-list">
        {providers === null ? (
          <div className="mcp-empty">加载中…</div>
        ) : providers.length === 0 ? (
          <div className="mcp-empty">还没有配置供应商。添加后，用户才能在聊天里选择模型。</div>
        ) : (
          providers.map((provider) => (
            <div className="mcp-row" key={provider.id}>
              <div className="mcp-row-main">
                <div className="mcp-row-name">
                  {provider.name}
                  {provider.primary ? <span className="chip chip-accent">默认 primary</span> : null}
                  <span className="chip">{provider.models.length} 个模型</span>
                </div>
                <div className="mcp-row-detail">
                  {provider.baseUrl} · 默认模型 {provider.defaultModel}
                </div>
              </div>
              <div className="mcp-row-actions">
                {provider.primary ? null : (
                  <button className="btn btn-ghost" title="设为默认供应商" onClick={() => void promote(provider)}>
                    设为默认
                  </button>
                )}
                <button className="btn btn-ghost" onClick={() => startEdit(provider)}>
                  编辑
                </button>
                {provider.primary ? (
                  <button
                    className="btn btn-ghost"
                    disabled
                    title="主供应商不可删除，请先把其他供应商设为默认"
                  >
                    删除
                  </button>
                ) : deleteArmed === provider.id ? (
                  <button className="btn btn-danger" onClick={() => void remove(provider)}>
                    确认删除
                  </button>
                ) : (
                  <button className="btn btn-ghost" onClick={() => setDeleteArmed(provider.id)}>
                    删除
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {editor ? (
        <div className="mcp-editor">
          <h3>{editor.mode === 'create' ? '添加供应商' : `编辑 ${editor.name}`}</h3>
          {formError ? <div className="error-banner">{formError}</div> : null}

          <div className="dialog-field">
            <label className="field-label" htmlFor="llm-provider-name">
              名称
            </label>
            <input
              id="llm-provider-name"
              className="input"
              value={editor.name}
              placeholder="如 OpenAI / DeepSeek"
              onChange={(e) => setEditor({ ...editor, name: e.target.value })}
            />
          </div>

          <div className="dialog-field">
            <label className="field-label" htmlFor="llm-provider-base-url">
              Base URL
            </label>
            <input
              id="llm-provider-base-url"
              className="input"
              type="text"
              placeholder="https://api.openai.com/v1"
              value={editor.baseUrl}
              onChange={(e) => setEditor({ ...editor, baseUrl: e.target.value })}
            />
          </div>

          <div className="dialog-field">
            <label className="field-label" htmlFor="llm-provider-api-key">
              API Key
            </label>
            <input
              id="llm-provider-api-key"
              className="input"
              type="password"
              placeholder={editor.mode === 'edit' ? '已设置（留空保持不变）' : '必填'}
              value={editor.apiKey}
              onChange={(e) => setEditor({ ...editor, apiKey: e.target.value })}
              autoComplete="new-password"
            />
          </div>

          <div className="dialog-field">
            <label className="field-label">模型列表</label>
            {editor.models.map((model) => (
              <div className="kv-row" key={model}>
                <span className="llm-model-chip">{model}</span>
                <button
                  className="btn btn-ghost"
                  aria-label={`移除模型 ${model}`}
                  onClick={() => removeModel(model)}
                >
                  ×
                </button>
              </div>
            ))}
            <div className="kv-row">
              <input
                className="input"
                placeholder="模型名称，如 gpt-4o-mini"
                value={editor.newModel}
                onChange={(e) => setEditor({ ...editor, newModel: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addModel()
                  }
                }}
              />
              <button className="btn btn-ghost" onClick={addModel}>
                添加
              </button>
              <button className="btn btn-ghost" onClick={() => void detectModels()} disabled={detecting}>
                {detecting ? <span className="spinner" /> : null}
                检测可用模型
              </button>
            </div>
            {modelHint ? <div className="llm-clear-note">{modelHint}</div> : null}
          </div>

          <div className="dialog-field">
            <label className="field-label" htmlFor="llm-provider-default-model">
              默认模型
            </label>
            <select
              id="llm-provider-default-model"
              className="input"
              value={editor.defaultModel}
              disabled={editor.models.length === 0}
              onChange={(e) => setEditor({ ...editor, defaultModel: e.target.value })}
            >
              {editor.models.length === 0 ? <option value="">请先添加模型</option> : null}
              {editor.models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <div className="llm-clear-note">用户未选模型时的兜底；主供应商的默认模型即全局默认。</div>
          </div>

          <div className="dialog-actions">
            <button className="btn" onClick={() => setEditor(null)} disabled={saving}>
              取消
            </button>
            <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? <span className="spinner" /> : null}
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={startCreate}>
            添加供应商
          </button>
        </div>
      )}
    </section>
  )
}
