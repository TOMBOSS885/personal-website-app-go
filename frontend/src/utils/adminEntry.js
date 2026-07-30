const PRIVATE_ENTRY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/
const LEGACY_ENTRY = 'admin'

// These public routes and physical directories must never cause an admin session check.
const PUBLIC_ROOTS = new Set(['', 'api', 'assets', 'blog', 'projects', 'search', 'uploads'])

export function getAdminEntrySuffix(pathname = typeof window === 'undefined' ? '' : window.location.pathname) {
  const firstSegment = String(pathname).split('/').filter(Boolean)[0] || ''
  if (firstSegment === LEGACY_ENTRY) return LEGACY_ENTRY
  if (PUBLIC_ROOTS.has(firstSegment.toLowerCase())) return ''
  return PRIVATE_ENTRY_PATTERN.test(firstSegment) ? firstSegment : ''
}

export function getAdminBasePath(pathname) {
  const suffix = getAdminEntrySuffix(pathname)
  return suffix ? `/${suffix}` : `/${LEGACY_ENTRY}`
}

export function isAdminEntryPath(pathname) {
  return getAdminEntrySuffix(pathname) !== ''
}
