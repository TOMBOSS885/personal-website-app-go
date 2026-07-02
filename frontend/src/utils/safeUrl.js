const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function safeExternalHref(value) {
  if (!value || typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  try {
    const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    const url = new URL(trimmed, base)
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return ''
    return url.href
  } catch {
    return ''
  }
}
