import { useEffect, useState } from 'react'
import { fetchWithAuth } from '../api/client'

/**
 * Renders a chat image. API-backed URLs (/api/...) need the Authorization
 * header, which a plain <img src> cannot send — fetch the bytes with auth and
 * show them through an object URL. Data URIs and external URLs render as-is.
 */
export function AuthImage({ src, className }: { src: string; className?: string }) {
  const isApi = src.startsWith('/api/')
  const [url, setUrl] = useState<string | null>(isApi ? null : src)

  useEffect(() => {
    if (!isApi) {
      setUrl(src)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    fetchWithAuth(src)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src, isApi])

  return <img className={className} src={url ?? undefined} alt="" />
}
