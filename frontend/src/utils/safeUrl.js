const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])
const DOWNLOAD_PROTOCOLS = new Set(['http:', 'https:'])

function safeHref(value, allowedProtocols) {
  if (!value || typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  try {
    const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    const url = new URL(trimmed, base)
    if (!allowedProtocols.has(url.protocol)) return ''
    return url.href
  } catch {
    return ''
  }
}

export function safeExternalHref(value) {
  return safeHref(value, ALLOWED_PROTOCOLS)
}

export function safeDownloadHref(value) {
  return safeHref(value, DOWNLOAD_PROTOCOLS)
}
