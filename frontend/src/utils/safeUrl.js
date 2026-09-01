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

export function safeStaticSiteSrc(value, origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin) {
  if (!value || typeof value !== 'string') return ''
  try {
    const url = new URL(value.trim(), origin)
    if (url.origin !== origin || url.username || url.password) return ''
    const signedArticleSite = /^\/api\/public\/article-sites\/\d+\/[a-f0-9-]{32,64}\/\d+\/\d+\/[a-f0-9]{64}(?:\/.*)?$/i
    if (!signedArticleSite.test(url.pathname)) return ''
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return ''
  }
}

export function safeInternalPath(value, fallback = '/') {
  if (typeof value !== 'string') return fallback
  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback
  try {
    const url = new URL(path, 'http://localhost')
    return url.origin === 'http://localhost' ? `${url.pathname}${url.search}${url.hash}` : fallback
  } catch {
    return fallback
  }
}
