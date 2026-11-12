import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { InviteCodeResponse } from '../api/types'

/**
 * The invite-code queue: mint a code for a target address, email it, and watch
 * it get consumed by registration. The code itself is the credential.
 */
export function AdminInviteCodesSection() {
  const [invites, setInvites] = useState<InviteCodeResponse[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [validDays, setValidDays] = useState('7')
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [actionHint, setActionHint] = useState<string | null>(null)
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setInvites(await api.adminInviteCodes())
      setListError(null)
    } catch (err) {
      setListError(err instanceof Error ? err.message : '加载失败')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function create() {
    const target = email.trim()
    if (!target) {
      setFormError('请填写收件邮箱')
      return
    }
    const days = Number(validDays)
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setFormError('有效期需在 1–365 天之间')
      return
    }
    setCreating(true)
    setFormError(null)
    setActionHint(null)
    try {
      const created = await api.createAdminInviteCode({ email: target, note: note.trim() || null, validDays: days })
      setEmail('')
      setNote('')
      await reload()
      setActionHint(`已生成邀请码 ${created.code}`)
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : '生成失败')
    } finally {
      setCreating(false)
    }
  }

  async function send(invite: InviteCodeResponse) {
    setBusyCode(invite.code)
    setActionHint(null)
    try {
      const updated = await api.sendAdminInviteCode(invite.code)
      await reload()
      setActionHint(`邀请码 ${updated.code} 已发送至 ${updated.email}`)
    } catch (err) {
      setListError(err instanceof Error ? err.message : '发送失败')
    } finally {
      setBusyCode(null)
    }
  }

  async function remove(invite: InviteCodeResponse) {
    setBusyCode(invite.code)
    try {
      await api.deleteAdminInviteCode(invite.code)
      setDeleteArmed(null)
      await reload()
    } catch (err) {
      setListError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setBusyCode(null)
    }
  }

  return (
    <section className="llm-settings">
      <h2>邀请码</h2>
      <p className="admin-sub">
        为待注册用户生成邀请码并通过邮件发送；用户在注册页凭邀请码完成注册后，该码即作废。
        也可以复制邀请码手动发给对方。
      </p>

      {listError ? <div className="error-banner">{listError}</div> : null}
      {actionHint ? <div className="llm-clear-note">{actionHint}</div> : null}

      <div className="mcp-editor">
        {formError ? <div className="error-banner">{formError}</div> : null}
        <div className="dialog-field">
          <label className="field-label" htmlFor="invite-email">
            收件邮箱
          </label>
          <input
            id="invite-email"
            className="input"
            type="email"
            value={email}
            placeholder="邀请对象的邮箱"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="dialog-field">
          <label className="field-label" htmlFor="invite-note">
            备注（可选）
          </label>
          <input
            id="invite-note"
            className="input"
            value={note}
            placeholder="如：张三 · 运营组"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="dialog-field">
          <label className="field-label" htmlFor="invite-days">
            有效期（天）
          </label>
          <input
            id="invite-days"
            className="input"
            type="number"
            min={1}
            max={365}
            value={validDays}
            onChange={(e) => setValidDays(e.target.value)}
          />
        </div>
        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={() => void create()} disabled={creating}>
            {creating ? <span className="spinner" /> : null}
            生成邀请码
          </button>
        </div>
      </div>

      <div className="mcp-list">
        {invites === null ? (
          <div className="mcp-empty">加载中…</div>
        ) : invites.length === 0 ? (
          <div className="mcp-empty">还没有邀请码。生成后在这里跟踪发送与使用状态。</div>
        ) : (
          invites.map((invite) => (
            <div className="mcp-row" key={invite.code}>
              <div className="mcp-row-main">
                <div className="mcp-row-name">
                  <span className="mono">{invite.code}</span>
                  <span className={`chip${invite.usedBy ? '' : ' chip-accent'}`}>{statusOf(invite)}</span>
                </div>
                <div className="mcp-row-detail">
                  {invite.email}
                  {invite.note ? ` · ${invite.note}` : ''} · 有效期至 {formatTime(invite.expiresAt)}
                  {invite.usedBy ? ` · 被 ${invite.usedBy} 使用` : ''}
                </div>
              </div>
              <div className="mcp-row-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => void navigator.clipboard.writeText(invite.code)}
                  title="复制邀请码"
                >
                  复制
                </button>
                {invite.usedBy ? null : (
                  <button
                    className="btn btn-ghost"
                    onClick={() => void send(invite)}
                    disabled={busyCode === invite.code}
                  >
                    {busyCode === invite.code ? <span className="spinner" /> : null}
                    {invite.sentAt ? '重新发送' : '发送邮件'}
                  </button>
                )}
                {deleteArmed === invite.code ? (
                  <button className="btn btn-danger" onClick={() => void remove(invite)} disabled={busyCode === invite.code}>
                    确认删除
                  </button>
                ) : (
                  <button className="btn btn-ghost" onClick={() => setDeleteArmed(invite.code)}>
                    删除
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function statusOf(invite: InviteCodeResponse): string {
  if (invite.usedBy) return '已使用'
  if (Date.parse(invite.expiresAt) < Date.now()) return '已过期'
  return invite.sentAt ? '已发送' : '未发送'
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}
