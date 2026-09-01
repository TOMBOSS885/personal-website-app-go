import { getAdminEntrySuffix } from '../utils/adminEntry'

let csrfToken = ''
let installed = false

export function setAdminCsrfToken(value) {
  csrfToken = typeof value === 'string' ? value : ''
}

export function getSharedHostTransport(method, isAdminRequest) {
  if (isAdminRequest && method === 'DELETE') {
    return { method: 'POST', override: 'DELETE' }
  }
  return { method, override: '' }
}

export function classifyApiRequest(value, origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin) {
  try {
    const url = new URL(typeof value === 'string' ? value : value?.url || '', origin)
    if (url.origin !== origin) return { isAdminRequest: false, isAdminAuth: false, isAuthMutation: false }
    const path = url.pathname.replace(/\/+$/, '')
    const isAdminRequest = path === '/api/admin' || path.startsWith('/api/admin/')
    const isAdminAuth = path === '/api/auth/login' || path === '/api/auth/logout'
    return { isAdminRequest, isAdminAuth, isAuthMutation: path === '/api/auth/logout' }
  } catch {
    return { isAdminRequest: false, isAdminAuth: false, isAuthMutation: false }
  }
}

export function installAdminFetchInterceptor() {
  if (installed || typeof window === 'undefined') return
  installed = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const method = String(init.method || input?.method || 'GET').toUpperCase()
    const headers = new Headers(init.headers || input?.headers || {})
    const { isAdminRequest, isAdminAuth, isAuthMutation } = classifyApiRequest(input)
    const transport = getSharedHostTransport(method, isAdminRequest)

    // Shared-host authentication is cookie/session based. Drop legacy JWT headers.
    if (isAdminRequest || isAuthMutation) headers.delete('Authorization')
    if (isAdminRequest || isAdminAuth) {
      const entry = getAdminEntrySuffix()
      if (entry) headers.set('X-Admin-Entry', entry)
    }
    if (transport.override) headers.set('X-HTTP-Method-Override', transport.override)
    if ((isAdminRequest || isAuthMutation) && !['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
      headers.set('X-CSRF-Token', csrfToken)
    }

    const response = await originalFetch(input, {
      ...init,
      method: transport.method,
      headers,
      credentials: init.credentials || 'same-origin',
    })

    if (isAdminRequest && response.status === 401) {
      window.dispatchEvent(new CustomEvent('admin:unauthorized'))
    }
    return response
  }
}
