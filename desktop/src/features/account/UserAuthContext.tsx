import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError, userApi } from '../../shared/api/client'
import type { PublicUser } from '../../shared/api/types'
import { deleteUserToken, loadUserToken, saveUserToken } from '../../shared/lib/platform'
import { useSettings } from '../../shared/settings/SettingsContext'

type RegisterInput = { email: string; code: string; username: string; password: string; remember?: boolean }
type AuthValue = {
  user: PublicUser | null
  accessToken: string | null
  loading: boolean
  isAuthenticated: boolean
  login: (identifier: string, password: string, remember?: boolean) => Promise<PublicUser>
  register: (input: RegisterInput) => Promise<PublicUser>
  requestCode: (email: string, purpose: 'register' | 'reset') => Promise<unknown>
  resetPassword: (input: { email: string; code: string; password: string }) => Promise<void>
  updateUsername: (username: string) => Promise<PublicUser>
  logout: () => Promise<void>
  clearSession: () => Promise<void>
}

const UserAuthContext = createContext<AuthValue | null>(null)

export function UserAuthProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const [user, setUser] = useState<PublicUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const clearSession = useCallback(async () => {
    setUser(null)
    setAccessToken(null)
    await deleteUserToken(settings.serverUrl).catch(() => undefined)
  }, [settings.serverUrl])

  useEffect(() => {
    let active = true
    setLoading(true)
    setUser(null)
    setAccessToken(null)
    loadUserToken(settings.serverUrl)
      .then(async (token) => {
        if (!token || !active) return
        try {
          const currentUser = await userApi.me(settings.serverUrl, token)
          if (active) {
            setAccessToken(token)
            setUser(currentUser)
          }
        } catch (error) {
          if (error instanceof ApiError && [401, 403].includes(error.status)) {
            await deleteUserToken(settings.serverUrl).catch(() => undefined)
          }
        }
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [settings.serverUrl])

  const login = useCallback(async (identifier: string, password: string, remember = true) => {
    let result
    try {
      result = await userApi.desktopLogin(settings.serverUrl, identifier, password)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new Error('服务器尚未启用桌面登录，请先部署最新 Go 后端')
      }
      throw error
    }
    if (remember) await saveUserToken(settings.serverUrl, result.accessToken)
    else await deleteUserToken(settings.serverUrl).catch(() => undefined)
    setAccessToken(result.accessToken)
    setUser(result.user)
    return result.user
  }, [settings.serverUrl])

  const register = useCallback(async (input: RegisterInput) => {
    await userApi.register(settings.serverUrl, input)
    return login(input.email, input.password, input.remember)
  }, [login, settings.serverUrl])

  const requestCode = useCallback((email: string, purpose: 'register' | 'reset') =>
    userApi.requestCode(settings.serverUrl, email, purpose), [settings.serverUrl])

  const resetPassword = useCallback(async (input: { email: string; code: string; password: string }) => {
    await userApi.resetPassword(settings.serverUrl, input)
    await clearSession()
  }, [clearSession, settings.serverUrl])

  const updateUsername = useCallback(async (username: string) => {
    if (!accessToken) throw new Error('请先登录')
    const updated = await userApi.updateUsername(settings.serverUrl, accessToken, username)
    setUser(updated)
    return updated
  }, [accessToken, settings.serverUrl])

  const logout = useCallback(async () => {
    try {
      if (accessToken) await userApi.logout(settings.serverUrl, accessToken)
    } finally {
      await clearSession()
    }
  }, [accessToken, clearSession, settings.serverUrl])

  const value = useMemo<AuthValue>(() => ({
    user, accessToken, loading, isAuthenticated: Boolean(user && accessToken), login, register,
    requestCode, resetPassword, updateUsername, logout, clearSession,
  }), [user, accessToken, loading, login, register, requestCode, resetPassword, updateUsername, logout, clearSession])
  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>
}

export function useUserAuth() {
  const value = useContext(UserAuthContext)
  if (!value) throw new Error('useUserAuth must be used inside UserAuthProvider')
  return value
}
