import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const UserAuthContext = createContext(null)

async function requestUserAuth(path, body = {}) {
  const response = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || `请求失败（${response.status}）`)
    error.code = data.code || ''
    throw error
  }
  return data
}

function normalizeSessionUser(data, fallbackEmail = '') {
  return {
    id: Number(data.userId) || null,
    email: data.email || fallbackEmail,
    csrfToken: data.csrfToken || '',
    hasOAuthIdentity: Boolean(data.hasOAuthIdentity),
  }
}

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const clearUser = useCallback(() => setUser(null), [])
  const checkSession = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/user-session', { cache: 'no-store', credentials: 'same-origin' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.authenticated) throw new Error('not authenticated')
      setUser(normalizeSessionUser(data))
      return true
    } catch { clearUser(); return false } finally { setLoading(false) }
  }, [clearUser])
  useEffect(() => {
    void checkSession()
    const onUnauthorized = () => clearUser()
    window.addEventListener('user:unauthorized', onUnauthorized)
    return () => window.removeEventListener('user:unauthorized', onUnauthorized)
  }, [checkSession, clearUser])
  const login = useCallback(async (email, password) => {
    const data = await requestUserAuth('/api/auth/user-login', { email, password })
    setUser(normalizeSessionUser(data, email)); return data
  }, [])
  const register = useCallback(async (email, password, emailCode = '') => {
    const data = await requestUserAuth('/api/auth/user-register', { email, password, emailCode })
    setUser(normalizeSessionUser(data, email)); return data
  }, [])
  const logout = useCallback(async () => {
    try { await requestUserAuth('/api/auth/user-logout') } finally { clearUser() }
  }, [clearUser])
  const value = useMemo(() => ({ user, loading, login, register, logout, checkSession }), [user, loading, login, register, logout, checkSession])
  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>
}

export function useUserAuth() {
  const value = useContext(UserAuthContext)
  if (!value) throw new Error('useUserAuth must be used inside UserAuthProvider')
  return value
}
