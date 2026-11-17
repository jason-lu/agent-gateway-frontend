import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { MemoryEntryResponse, MemoryListResponse } from '../api/types'

const KIND_LABELS: Record<string, string> = { fact: '事实', preference: '偏好' }
const SOURCE_LABELS: Record<string, string> = { explicit: '你要求记住', auto: '自动记下', confirm: '你确认过' }
const GENDER_LABELS: Record<string, string> = { male: '男', female: '女', unspecified: '不愿透露' }

/**
 * The memory panel: the whitelisted personal archive (称呼 / 性别 / 生活城市)
 * plus every stored fact/preference entry. New entries come from the chat
 * (memory_save); here you can see, edit, and delete them. Edits pass the same
 * hard-identifier gate as the write tools.
 */
export function MemorySection() {
  const [data, setData] = useState<MemoryListResponse | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [okMessage, setOkMessage] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState('')
  const [city, setCity] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null)
  const [clearArmed, setClearArmed] = useState(false)

  const reload = useCallback(async () => {
    try {
      const list = await api.listMemories()
      setData(list)
      setNickname(list.profile.nickname ?? '')
      setGender(list.profile.gender ?? '')
      setCity(list.profile.city ?? '')
      setListError(null)
    } catch (err) {
      setListError(err instanceof Error ? err.message : '加载失败')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function saveProfile() {
    setSavingProfile(true)
    setFormError(null)
    setOkMessage(null)
    try {
      await api.updateProfile({
        nickname: nickname.trim() || null,
        gender: gender || null,
        city: city.trim() || null,
      })
      setOkMessage('个人档案已保存')
      await reload()
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : '保存失败')
    } finally {
      setSavingProfile(false)
    }
  }

  function startEdit(entry: MemoryEntryResponse) {
    setFormError(null)
    setDeleteArmed(null)
    setEditingId(entry.id)
    setEditText(entry.content)
  }

  async function saveEntry(id: string) {
    const content = editText.trim()
    if (!content) return
    setSavingEntry(true)
    setFormError(null)
    try {
      await api.updateMemory(id, { content })
      setEditingId(null)
      await reload()
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : '保存失败')
    } finally {
      setSavingEntry(false)
    }
  }

  async function removeEntry(id: string) {
    setFormError(null)
    try {
      await api.deleteMemory(id)
      setDeleteArmed(null)
      if (editingId === id) setEditingId(null)
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '删除失败')
    }
  }

  async function clearAll() {
    setFormError(null)
    try {
      await api.clearMemories()
      setClearArmed(false)
      setEditingId(null)
      setOkMessage('记忆已全部清空')
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '清空失败')
    }
  }

  return (
    <div className="settings-pane">
      <p className="dialog-sub">
        这里的记忆只属于你的账号：称呼、性别、生活城市，以及你让助手记住的事实与偏好。
        含身份信息的内容（手机号、邮箱、证件、精确住址等）按隐私策略从不记录，编辑时同样受此限制。
      </p>

      {listError ? <div className="error-banner">{listError}</div> : null}
      {formError ? <div className="error-banner">{formError}</div> : null}
      {okMessage ? <div className="ok-banner">{okMessage}</div> : null}

      <div className="dialog-field">
        <label className="field-label" htmlFor="mem-nickname">
          称呼
        </label>
        <input
          id="mem-nickname"
          className="input"
          value={nickname}
          maxLength={32}
          placeholder="希望助手怎么称呼你"
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      <div className="dialog-field">
        <label className="field-label" htmlFor="mem-gender">
          性别
        </label>
        <select
          id="mem-gender"
          className="input"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
        >
          <option value="">不设置</option>
          <option value="male">{GENDER_LABELS.male}</option>
          <option value="female">{GENDER_LABELS.female}</option>
          <option value="unspecified">{GENDER_LABELS.unspecified}</option>
        </select>
      </div>

      <div className="dialog-field">
        <label className="field-label" htmlFor="mem-city">
          生活城市
        </label>
        <input
          id="mem-city"
          className="input"
          value={city}
          maxLength={32}
          placeholder="只写到市级，例如：杭州"
          onChange={(e) => setCity(e.target.value)}
        />
      </div>

      <button className="btn btn-primary" onClick={() => void saveProfile()} disabled={savingProfile}>
        保存档案
      </button>

      <div className="mcp-list">
        {data === null ? (
          <div className="mcp-empty">加载中…</div>
        ) : data.entries.length === 0 ? (
          <div className="mcp-empty">
            还没有记忆条目。对话里说「记住：…」，或让助手自己记下稳定事实与偏好。
          </div>
        ) : (
          data.entries.map((entry) => (
            <div className="mcp-row" key={entry.id}>
              <div className="mcp-row-main">
                {editingId === entry.id ? (
                  <textarea
                    className="input"
                    rows={2}
                    value={editText}
                    maxLength={500}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                ) : (
                  <div className="mcp-row-detail">{entry.content}</div>
                )}
                <div className="mcp-row-name">
                  <span className="chip">{KIND_LABELS[entry.kind] ?? entry.kind}</span>
                  <span className="chip">{SOURCE_LABELS[entry.source] ?? entry.source}</span>
                </div>
              </div>
              <div className="mcp-row-actions">
                {editingId === entry.id ? (
                  <>
                    <button
                      className="btn btn-primary"
                      disabled={savingEntry}
                      onClick={() => void saveEntry(entry.id)}
                    >
                      保存
                    </button>
                    <button className="btn btn-ghost" onClick={() => setEditingId(null)}>
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-ghost" onClick={() => startEdit(entry)}>
                      编辑
                    </button>
                    {deleteArmed === entry.id ? (
                      <button className="btn btn-ghost" onClick={() => void removeEntry(entry.id)}>
                        确认删除
                      </button>
                    ) : (
                      <button className="btn btn-ghost" onClick={() => setDeleteArmed(entry.id)}>
                        删除
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {data !== null &&
      (data.entries.length > 0 ||
        data.profile.nickname ||
        data.profile.gender ||
        data.profile.city) ? (
        <div className="dialog-field">
          {clearArmed ? (
            <button className="btn btn-primary" onClick={() => void clearAll()}>
              确认清空全部记忆（含个人档案）
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={() => setClearArmed(true)}>
              清空全部记忆
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
