import { useEffect, useState } from 'react'

/**
 * Renders one TeX formula via KaTeX. The library is loaded lazily on first
 * use (same deal as the mermaid chunk) so the chat bundle stays light; once
 * loaded, rendering is synchronous — `useState` seeds from the cache — so
 * streaming output never flashes raw source. Until KaTeX arrives the raw TeX
 * is shown instead; invalid TeX renders as KaTeX's own error markup
 * (throwOnError: false) rather than blowing up the message.
 */
export function MathFormula({ tex, display }: { tex: string; display: boolean }) {
  const [html, setHtml] = useState<string | null>(() => renderIfLoaded(tex, display))

  useEffect(() => {
    if (katexModule) {
      setHtml(renderIfLoaded(tex, display))
      return
    }
    let alive = true
    loadKatex().then(() => {
      if (alive) setHtml(renderIfLoaded(tex, display))
    })
    return () => {
      alive = false
    }
  }, [tex, display])

  if (html === null) {
    return display ? (
      <div className="md-math-raw">{tex}</div>
    ) : (
      <span className="md-math-raw-inline">{tex}</span>
    )
  }
  // KaTeX output is produced by KaTeX itself with `trust` off (no \href/\url/
  // raw HTML passes through), so injecting it is safe for untrusted LLM text.
  return display ? (
    <div className="md-math-display" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className="md-math-inline" dangerouslySetInnerHTML={{ __html: html }} />
  )
}

type Katex = typeof import('katex').default

let katexModule: Katex | null = null
let katexLoading: Promise<Katex> | null = null

/** Loads KaTeX once; resolves immediately on later calls. */
export function loadKatex(): Promise<Katex> {
  if (!katexLoading) {
    katexLoading = import('katex').then((m) => {
      katexModule = m.default
      return m.default
    })
  }
  return katexLoading
}

function renderIfLoaded(tex: string, display: boolean): string | null {
  if (!katexModule) return null
  return katexModule.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
  })
}
