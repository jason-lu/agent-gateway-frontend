import { useEffect, useState } from 'react'
import { ChangePasswordSection } from './ChangePasswordSection'
import { McpServersSection } from './McpServersSection'
import { MemorySection } from './MemorySection'
import { ToolEnvSection } from './ToolEnvSection'

interface SettingsDialogProps {
  onClose: () => void
}

type SettingsTab = 'mcp' | 'toolenv' | 'memory' | 'security'

/** Account settings: personal MCP servers, tool credentials and password management. */
export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [tab, setTab] = useState<SettingsTab>('mcp')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog dialog-wide"
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-head">
          <h2>设置</h2>
          <button className="btn btn-ghost" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'mcp'}
            className={tab === 'mcp' ? 'active' : ''}
            onClick={() => setTab('mcp')}
          >
            MCP 服务器
          </button>
          <button
            role="tab"
            aria-selected={tab === 'toolenv'}
            className={tab === 'toolenv' ? 'active' : ''}
            onClick={() => setTab('toolenv')}
          >
            工具凭据
          </button>
          <button
            role="tab"
            aria-selected={tab === 'memory'}
            className={tab === 'memory' ? 'active' : ''}
            onClick={() => setTab('memory')}
          >
            记忆
          </button>
          <button
            role="tab"
            aria-selected={tab === 'security'}
            className={tab === 'security' ? 'active' : ''}
            onClick={() => setTab('security')}
          >
            账号安全
          </button>
        </div>

        {tab === 'mcp' ? (
          <McpServersSection />
        ) : tab === 'toolenv' ? (
          <ToolEnvSection />
        ) : tab === 'memory' ? (
          <MemorySection />
        ) : (
          <ChangePasswordSection />
        )}
      </div>
    </div>
  )
}
