import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const UserAuthContext = createContext(null)

async function readResponse(response) {
  const contentType = response.headers.get('content-type') || ''
	const isJSON = contentType.includes('application/json')
	const body = isJSON
    ? await response.json().catch(() => ({}))
    : { message: await response.text().catch(() => '') }

  if (!response.ok) {
		const htmlGatewayError = !isJSON && /<(!doctype|html)[\s>]/i.test(body?.message || '')
		const message = htmlGatewayError
		  ? `服务器暂时无法连接（HTTP ${response.status}），请稍后重试`
		  : body?.message || '请求失败，请稍后重试'
		const error = new Error(message)
    error.status = response.status
    error.data = body
    throw error
  }
  return body
}

async function userRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  })
  return readResponse(response)
}

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const authFetch = useCallback(async (input, options = {}) => {
    const { clearSessionOnUnauthorized = false, ...fetchOptions } = options
    const response = await fetch(input, {
      ...fetchOptions,
      credentials: 'same-origin',
    })
    if (response.status === 401 && clearSessionOnUnauthorized) {
      setUser(null)
    }
    return response
  }, [])

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const currentUser = await userRequest('/api/account/me')
      setUser(currentUser)
      return currentUser
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setUser(null)
        return null
      }
      throw error
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    userRequest('/api/account/me')
      .then(currentUser => {
        if (active) setUser(currentUser)
      })
      .catch(error => {
        if (active && error.status !== 401 && error.status !== 403) {
          console.warn('Unable to restore user session:', error)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

	const requestCode = useCallback((email, purpose) => userRequest('/api/user-auth/code', {
    method: 'POST',
		body: JSON.stringify({ email: email.trim(), purpose }),
  }), [])

	const login = useCallback(async (identifier, password) => {
    const currentUser = await userRequest('/api/user-auth/login', {
      method: 'POST',
			body: JSON.stringify({ identifier: identifier.trim(), password }),
    })
    setUser(currentUser)
    return currentUser
  }, [])

	const register = useCallback(async ({ email, code, username, password }) => {
		const currentUser = await userRequest('/api/user-auth/register', {
			method: 'POST',
			body: JSON.stringify({
				email: email.trim(),
				code: code.trim(),
				username: username.trim(),
				password,
			}),
		})
		setUser(currentUser)
		return currentUser
	}, [])

	const resetPassword = useCallback(({ email, code, password }) => userRequest('/api/user-auth/password/reset', {
		method: 'POST',
		body: JSON.stringify({ email: email.trim(), code: code.trim(), password }),
	}), [])

  const logout = useCallback(async () => {
    try {
      await userRequest('/api/account/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  }, [])

  const updateUsername = useCallback(async username => {
    const currentUser = await userRequest('/api/account/username', {
      method: 'PUT',
      body: JSON.stringify({ username: username.trim() }),
    })
    setUser(currentUser)
    return currentUser
  }, [])

  const openLogin = useCallback((returnTo = '') => {
    const fallback = typeof window === 'undefined'
      ? '/'
      : `${window.location.pathname}${window.location.search}${window.location.hash}`
    const target = returnTo || fallback
    window.location.assign(`/login?returnTo=${encodeURIComponent(target)}`)
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    authFetch,
    requestCode,
    login,
		register,
		resetPassword,
    logout,
    refresh,
    openLogin,
    updateUsername,
	}), [user, loading, authFetch, requestCode, login, register, resetPassword, logout, refresh, openLogin, updateUsername])

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>
}

export function useUserAuth() {
  const context = useContext(UserAuthContext)
  if (!context) {
    throw new Error('useUserAuth must be used within UserAuthProvider')
  }
  return context
}
