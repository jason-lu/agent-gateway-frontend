import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import { SECRET_MASK } from '../api/types'
import type { McpServerResponse, McpServerRequest, McpTransport } from '../api/types'

interface KvRow {
  key: string
  value: string
}

interface EditorState {
  mode: 'create' | 'edit'
  name: string
  transport: McpTransport
  command: string
  argsText: string
  url: string
  enabled: boolean
  envRows: KvRow[]
  headerRows: KvRow[]
}

/** The caller's own MCP servers — personal config, never shared across accounts. */
export function McpServersSection() {
  const [servers, setServers] = useState<McpServerResponse[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setServers(await api.listMcpServers())
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
    setEditor({
      mode: 'create',
      name: '',
      transport: 'stdio',
      command: '',
      argsText: '',
      url: '',
      enabled: true,
      envRows: [],
      headerRows: [],
    })
  }

  function startEdit(server: McpServerResponse) {
    setFormError(null)
    setEditor({
      mode: 'edit',
      name: server.name,
      transport: server.transport,
      command: server.command ?? '',
      argsText: (server.args ?? []).join('\n'),
      url: server.url ?? '',
      enabled: server.enabled,
      envRows: toRows(server.env),
      headerRows: toRows(server.headers),
    })
  }

  async function save() {
    if (!editor) return
    const name = editor.name.trim()
    if (!name) {
      setFormError('请填写名称')
      return
    }
    const body: McpServerRequest = {
      name,
      transport: editor.transport,
      command: editor.transport === 'stdio' ? editor.command.trim() : null,
      args:
        editor.transport === 'stdio'
          ? editor.argsText
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
          : [],
      env: toMap(editor.envRows),
      url: editor.transport === 'http' ? editor.url.trim() : null,
      headers: toMap(editor.headerRows),
      enabled: editor.enabled,
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editor.mode === 'create') await api.createMcpServer(body)
      else await api.updateMcpServer(editor.name, body)
      setEditor(null)
      await reload()
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove(name: string) {
    try {
      await api.deleteMcpServer(name)
      setDeleteArmed(null)
      if (editor?.mode === 'edit' && editor.name === name) setEditor(null)
      await reload()
    } catch (err) {
      setListError(err instanceof Error ? err.message : '删除失败')
    }
  }

  async function toggleEnabled(server: McpServerResponse) {
    try {
      await api.updateMcpServer(server.name, {
        name: server.name,
        transport: server.transport,
        command: server.command,
        args: server.args ?? [],
        // The masked listing round-trips cleanly: the mask means "keep stored",
        // so this only flips the enabled flag.
        env: server.env,
        url: server.url,
        headers: server.headers,
        enabled: !server.enabled,
      })
      await reload()
    } catch (err) {
      setListError(err instanceof Error ? err.message : '操作失败')
    }
  }

  return (
    <div className="settings-pane">
      <p className="dialog-sub">
        这里的 MCP 服务器只属于你的账号：配置与凭据不会出现在其他用户的工具列表里。
        含有个人凭据的值不会回显，以 {SECRET_MASK} 显示时表示“保持原值”，清空即删除该项。
      </p>

      {listError ? <div className="error-banner">{listError}</div> : null}

      <div className="mcp-list">
        {servers === null ? (
          <div className="mcp-empty">加载中…</div>
        ) : servers.length === 0 ? (
          <div className="mcp-empty">还没有配置 MCP 服务器。添加后，下次对话即可使用其中的工具。</div>
        ) : (
          servers.map((server) => (
            <div className="mcp-row" key={server.name}>
              <div className="mcp-row-main">
                <div className="mcp-row-name">
                  {server.name}
                  <span className="chip">{server.transport}</span>
                  <span className={`mcp-status mcp-status-${server.status}`}>{statusLabel(server.status)}</span>
                </div>
                <div className="mcp-row-detail">
                  {server.transport === 'stdio'
                    ? [server.command, ...(server.args ?? [])].filter(Boolean).join(' ')
                    : server.url}
                </div>
              </div>
              <div className="mcp-row-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    void toggleEnabled(server)
                  }}
                >
                  {server.enabled ? '停用' : '启用'}
                </button>
                <button className="btn btn-ghost" onClick={() => startEdit(server)}>
                  编辑
                </button>
                {deleteArmed === server.name ? (
                  <button className="btn btn-danger" onClick={() => void remove(server.name)}>
                    确认删除
                  </button>
                ) : (
                  <button className="btn btn-ghost" onClick={() => setDeleteArmed(server.name)}>
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
          <h3>{editor.mode === 'create' ? '添加服务器' : `编辑 ${editor.name}`}</h3>
          {formError ? <div className="error-banner">{formError}</div> : null}

          <div className="dialog-field">
            <label className="field-label" htmlFor="mcp-name">
              名称
            </label>
            <input
              id="mcp-name"
              className="input"
              value={editor.name}
              disabled={editor.mode === 'edit'}
              placeholder="如 github"
              onChange={(e) => setEditor({ ...editor, name: e.target.value })}
            />
          </div>

          <div className="dialog-field">
            <label className="field-label" htmlFor="mcp-transport">
              类型
            </label>
            <select
              id="mcp-transport"
              className="input"
              value={editor.transport}
              onChange={(e) => setEditor({ ...editor, transport: e.target.value as McpTransport })}
            >
              <option value="stdio">stdio（本地命令）</option>
              <option value="http">http（远程 Streamable HTTP）</option>
            </select>
          </div>

          {editor.transport === 'stdio' ? (
            <>
              <div className="dialog-field">
                <label className="field-label" htmlFor="mcp-command">
                  命令
                </label>
                <input
                  id="mcp-command"
                  className="input"
                  value={editor.command}
                  placeholder="npx"
                  onChange={(e) => setEditor({ ...editor, command: e.target.value })}
                />
              </div>
              <div className="dialog-field">
                <label className="field-label" htmlFor="mcp-args">
                  参数（每行一个）
                </label>
                <textarea
                  id="mcp-args"
                  className="input textarea"
                  rows={3}
                  value={editor.argsText}
                  placeholder={'-y\n@playwright/mcp@latest'}
                  onChange={(e) => setEditor({ ...editor, argsText: e.target.value })}
                />
              </div>
              <KvEditor title="环境变量" rows={editor.envRows} onChange={(envRows) => setEditor({ ...editor, envRows })} />
            </>
          ) : (
            <>
              <div className="dialog-field">
                <label className="field-label" htmlFor="mcp-url">
                  URL
                </label>
                <input
                  id="mcp-url"
                  className="input"
                  value={editor.url}
                  placeholder="https://example.com/mcp"
                  onChange={(e) => setEditor({ ...editor, url: e.target.value })}
                />
              </div>
              <KvEditor
                title="请求头（凭据放这里）"
                rows={editor.headerRows}
                onChange={(headerRows) => setEditor({ ...editor, headerRows })}
              />
            </>
          )}

          <label className="mcp-enabled">
            <input
              type="checkbox"
              checked={editor.enabled}
              onChange={(e) => setEditor({ ...editor, enabled: e.target.checked })}
            />
            启用（停用后不参与对话）
          </label>

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
            添加服务器
          </button>
        </div>
      )}
    </div>
  )
}

function statusLabel(status: McpServerResponse['status']): string {
  switch (status) {
    case 'connected':
      return '已连接'
    case 'disconnected':
      return '未连接'
    case 'disabled':
      return '已停用'
    default:
      return '待连接'
  }
}

function toRows(map: Record<string, string>): KvRow[] {
  return Object.entries(map ?? {}).map(([key, value]) => ({ key, value }))
}

function toMap(rows: KvRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (key) out[key] = row.value
  }
  return out
}

function KvEditor({
  title,
  rows,
  onChange,
}: {
  title: string
  rows: KvRow[]
  onChange: (rows: KvRow[]) => void
}) {
  return (
    <div className="dialog-field">
      <label className="field-label">{title}</label>
      {rows.map((row, index) => (
        <div className="kv-row" key={index}>
          <input
            className="input"
            placeholder="键"
            value={row.key}
            onChange={(e) => {
              const next = [...rows]
              next[index] = { ...row, key: e.target.value }
              onChange(next)
            }}
          />
          <input
            className="input"
            placeholder="值"
            value={row.value}
            onChange={(e) => {
              const next = [...rows]
              next[index] = { ...row, value: e.target.value }
              onChange(next)
            }}
          />
          <button
            className="btn btn-ghost"
            aria-label="删除该项"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <button className="btn btn-ghost" onClick={() => onChange([...rows, { key: '', value: '' }])}>
        + 添加
      </button>
    </div>
  )
}
