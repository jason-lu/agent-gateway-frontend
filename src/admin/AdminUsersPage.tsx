import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AdminUserResponse } from '../api/types'

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .adminUsers()
      .then((data) => {
        if (!cancelled) setUsers(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="admin">
      <div className="admin-inner">
        <h1>用户管理</h1>
        <p className="admin-sub">
          来自 <span className="mono">agent.security.users</span> 配置的账号与角色。数据库账号以库内为准。
        </p>

        {error ? (
          <div className="error-banner">{error}</div>
        ) : users === null ? (
          <div className="center-fill" style={{ minHeight: 160 }}>
            <span className="spinner" /> 加载用户列表…
          </div>
        ) : users.length === 0 ? (
          <div className="error-banner">没有配置任何用户。</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>角色</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td>
                    <span className="mono">{u.username}</span>
                  </td>
                  <td>
                    <div className="role-chips">
                      {u.roles.map((r) => (
                        <span className={`chip${r === 'ADMIN' ? ' chip-accent' : ''}`} key={r}>
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
