import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { normalizeServerUrl } from '../api/client'
import type { Language } from '../api/types'

export type ColorMode = 'system' | 'light' | 'dark'

export interface AppSettings {
  serverUrl: string
  language: Language
  colorMode: ColorMode
  musicEnabled: boolean
}

type SettingsContextValue = {
  settings: AppSettings
  updateSettings: (next: Partial<AppSettings>) => void
}

const STORAGE_KEY = 'personal-blog-desktop:settings:v1'
export const DEFAULT_SERVER_URL = 'https://blog.tombossking.xyz'
const defaultServer = import.meta.env.VITE_API_BASE_URL || DEFAULT_SERVER_URL
const defaults: AppSettings = {
  serverUrl: normalizeServerUrl(defaultServer),
  language: 'zh',
  colorMode: 'system',
  musicEnabled: true,
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function loadSettings(): AppSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<AppSettings>
    return {
      serverUrl: normalizeServerUrl(stored.serverUrl ?? defaults.serverUrl),
      language: stored.language === 'en' ? 'en' : 'zh',
      colorMode: ['light', 'dark', 'system'].includes(stored.colorMode ?? '')
        ? stored.colorMode as ColorMode
        : 'system',
      musicEnabled: stored.musicEnabled !== false,
    }
  } catch {
    return defaults
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(loadSettings)

  const updateSettings = (next: Partial<AppSettings>) => {
    setSettings((current) => {
      const updated = { ...current, ...next }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyMode = () => {
      const resolved = settings.colorMode === 'system'
        ? media.matches ? 'dark' : 'light'
        : settings.colorMode
      root.dataset.theme = resolved
    }
    applyMode()
    media.addEventListener('change', applyMode)
    return () => media.removeEventListener('change', applyMode)
  }, [settings.colorMode])

  const value = useMemo(() => ({ settings, updateSettings }), [settings])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside SettingsProvider')
  return value
}
