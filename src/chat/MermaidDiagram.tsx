import { useEffect, useState, type ReactNode } from 'react'

/**
 * Renders a ```mermaid fence as a real diagram. The mermaid library is loaded
 * lazily on first use so the chat bundle stays light; while loading (or on a
 * syntax error) the caller's fallback — a plain code card — is shown instead.
 */
export function MermaidDiagram({ code, fallback }: { code: string; fallback: ReactNode }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const id = `mmd-${++renderSeq}`
    loadMermaid()
      .then((mermaid) => mermaid.render(id, code))
      .then((out) => {
        if (alive) setSvg(out.svg)
      })
      .catch(() => {
        document.getElementById(id)?.remove()
        document.getElementById(`d${id}`)?.remove()
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [code])

  if (failed) return <>{fallback}</>
  if (svg === null) return <div className="md-mermaid md-mermaid-pending" aria-hidden="true" />
  // The SVG is produced by mermaid itself under securityLevel 'strict'
  // (labels are sanitized, no HTML/script passes through).
  return <div className="md-mermaid" dangerouslySetInnerHTML={{ __html: svg }} />
}

let renderSeq = 0

let mermaidModule: Promise<Mermaid> | null = null
type Mermaid = typeof import('mermaid').default

function loadMermaid(): Promise<Mermaid> {
  if (!mermaidModule) {
    mermaidModule = import('mermaid').then((m) => {
      const mermaid = m.default
      mermaid.initialize({
        startOnLoad: false,
        suppressErrorRendering: true,
        theme: 'base',
        themeVariables: {
          background: '#ffffff',
          primaryColor: '#edeffd',
          primaryTextColor: '#17150f',
          primaryBorderColor: '#c6cbf7',
          secondaryColor: '#f3f1ec',
          tertiaryColor: '#faf9f7',
          lineColor: '#9c978c',
          textColor: '#17150f',
          fontFamily:
            "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
      })
      return mermaid
    })
  }
  return mermaidModule
}
