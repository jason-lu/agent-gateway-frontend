import { useEffect, useRef, useState } from 'react'

interface UserMenuProps {
  username: string
  isAdmin: boolean
  onOpenSettings: () => void
  onOpenAdmin: () => void
  onLogout: () => void
}

/** Top-right avatar: click opens a menu with the account actions. */
export function UserMenu({ username, isAdmin, onOpenSettings, onOpenAdmin, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const initial = username.slice(0, 1).toUpperCase()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const act = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="用户菜单"
        title={username}
        onClick={() => setOpen((v) => !v)}
      >
        {initial}
      </button>

      {open ? (
        <div className="user-menu-pop" role="menu">
          <div className="user-menu-head">
            <div className="user-avatar">{initial}</div>
            <div className="user-menu-id">
              <div className="user-menu-name">{username}</div>
              <div className="user-menu-role">{isAdmin ? '管理员' : '用户'}</div>
            </div>
          </div>

          <div className="user-menu-sep" />

          {isAdmin ? (
            <button className="user-menu-item" role="menuitem" onClick={act(onOpenAdmin)}>
              管理
            </button>
          ) : null}
          <button className="user-menu-item" role="menuitem" onClick={act(onOpenSettings)}>
            设置
          </button>

          <div className="user-menu-sep" />

          <button className="user-menu-item user-menu-item-danger" role="menuitem" onClick={act(onLogout)}>
            退出登录
          </button>
        </div>
      ) : null}
    </div>
  )
}
