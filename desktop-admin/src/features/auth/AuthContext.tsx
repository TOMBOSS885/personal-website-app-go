import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiClient, ApiError, normalizeServerOrigin } from '@shared/api/client'
import { credentialDelete, credentialGet, credentialSet, deleteSetting, readSetting, writeSetting } from '@shared/lib/platform'
import type { ServerProfile, SessionResponse, SessionUser } from './types'

const PROFILE_KEY = 'server-profile'

interface LoginInput {
  username: string
  password: string
  remember: boolean
}

interface AuthContextValue {
  booting: boolean
  profile: ServerProfile | null
  user: SessionUser | null
  token: string | null
  api: ApiClient | null
  configureServer: (origin: string, name?: string) => Promise<void>
  removeServer: () => Promise<void>
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [booting, setBooting] = useState(true)
  const [profile, setProfile] = useState<ServerProfile | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const tokenRef = useRef<string | null>(null)
  tokenRef.current = token

  const invalidateSession = useCallback(() => {
    const currentProfile = profile
    setToken(null)
    setUser(null)
    queryClient.clear()
    if (currentProfile) void credentialDelete(currentProfile.id)
  }, [profile, queryClient])

  const api = useMemo(() => profile ? new ApiClient(profile.origin, {
    getToken: () => tokenRef.current,
    onUnauthorized: invalidateSession,
  }) : null, [profile, invalidateSession])

  useEffect(() => {
    let active = true
    async function restore() {
      try {
        const saved = await readSetting<ServerProfile>(PROFILE_KEY)
        if (!active || !saved) return
        setProfile(saved)
        const savedToken = await credentialGet(saved.id)
        if (!active || !savedToken) return
        const restoreClient = new ApiClient(saved.origin, { getToken: () => savedToken })
        const session = await validateSession(restoreClient, saved)
        if (!active) return
        setToken(savedToken)
        setUser(session)
      } catch {
        // Keep the server profile and require a fresh login.
      } finally {
        if (active) setBooting(false)
      }
    }
    void restore()
    return () => { active = false }
  }, [])

  const configureServer = useCallback(async (originValue: string, name = '我的网站') => {
    const origin = normalizeServerOrigin(originValue)
    const client = new ApiClient(origin)
    await client.request<{ status: string }>('/api/health', { auth: false, timeoutMs: 7_000 })
    const next: ServerProfile = {
      id: profile?.id ?? 'primary',
      name: name.trim() || '我的网站',
      origin,
      websiteUrl: origin,
      createdAt: profile?.createdAt ?? new Date().toISOString(),
      lastConnectedAt: new Date().toISOString(),
    }
    if (profile && profile.origin !== origin) await credentialDelete(profile.id)
    await writeSetting(PROFILE_KEY, next)
    setProfile(next)
    setToken(null)
    setUser(null)
    queryClient.clear()
  }, [profile, queryClient])

  const removeServer = useCallback(async () => {
    if (profile) await credentialDelete(profile.id)
    await deleteSetting(PROFILE_KEY)
    setProfile(null)
    setToken(null)
    setUser(null)
    queryClient.clear()
  }, [profile, queryClient])

  const login = useCallback(async ({ username, password, remember }: LoginInput) => {
    if (!profile) throw new Error('请先配置服务器')
    const client = new ApiClient(profile.origin)
    const response = await client.request<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: { username: username.trim(), password },
      auth: false,
    })
    const authenticatedClient = new ApiClient(profile.origin, { getToken: () => response.token })
    const sessionUser = await validateSession(authenticatedClient, profile, username.trim())
    if (remember) await credentialSet(profile.id, response.token)
    else await credentialDelete(profile.id)
    setToken(response.token)
    setUser(sessionUser)
  }, [profile])

  const logout = useCallback(async () => {
    if (profile) await credentialDelete(profile.id)
    setToken(null)
    setUser(null)
    queryClient.clear()
  }, [profile, queryClient])

  const value = useMemo<AuthContextValue>(() => ({
    booting,
    profile,
    user,
    token,
    api,
    configureServer,
    removeServer,
    login,
    logout,
  }), [booting, profile, user, token, api, configureServer, removeServer, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

async function validateSession(client: ApiClient, profile: ServerProfile, fallbackUsername = 'Admin'): Promise<SessionUser> {
  try {
    const response = await client.request<SessionResponse>('/api/admin/session')
    return response.user
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error
    await client.request('/api/admin/dashboard-stats')
    return { username: fallbackUsername || profile.name, role: 'ADMIN' }
  }
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
