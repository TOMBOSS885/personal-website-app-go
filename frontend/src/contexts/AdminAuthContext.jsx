import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { setAdminCsrfToken } from '../api/adminFetch'
import { getAdminEntrySuffix } from '../utils/adminEntry'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const { pathname } = useLocation()
  const adminEntry = getAdminEntrySuffix(pathname)
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  const clearAdmin = useCallback(() => {
    setAdmin(null)
    setAdminCsrfToken('')
    localStorage.removeItem('username')
  }, [])

  const checkSession = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/session', { cache: 'no-store' })
      if (!response.ok) throw new Error('not authenticated')
      const data = await response.json()
      if (!data.authenticated) throw new Error('not authenticated')
      setAdmin({ username: data.username || 'admin' })
      setAdminCsrfToken(data.csrfToken || '')
      localStorage.setItem('username', data.username || 'admin')
      return true
    } catch {
      clearAdmin()
      return false
    } finally {
      setLoading(false)
    }
  }, [clearAdmin])

  useEffect(() => {
    if (!adminEntry) {
      setLoading(false)
      return undefined
    }
    void checkSession()
    const handleUnauthorized = () => clearAdmin()
    window.addEventListener('admin:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('admin:unauthorized', handleUnauthorized)
  }, [adminEntry, checkSession, clearAdmin])

  const login = useCallback(async (username, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || `登录失败（${response.status}）`)
    setAdmin({ username: data.username || username })
    setAdminCsrfToken(data.csrfToken || '')
    localStorage.setItem('username', data.username || username)
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      clearAdmin()
    }
  }, [clearAdmin])

  const value = useMemo(() => ({ admin, loading, login, logout, checkSession }), [admin, loading, login, logout, checkSession])
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const value = useContext(AdminAuthContext)
  if (!value) throw new Error('useAdminAuth must be used inside AdminAuthProvider')
  return value
}
