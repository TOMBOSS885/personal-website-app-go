import { invoke } from '@tauri-apps/api/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { Store } from '@tauri-apps/plugin-store'

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

const browserMemoryCredentials = new Map<string, string>()
const browserSettingsKey = 'personal-website-studio:settings'

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
}

export async function platformFetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauriRuntime()) {
    return tauriFetch(input, init)
  }
  return window.fetch(input, init)
}

export async function readSetting<T>(key: string): Promise<T | null> {
  if (isTauriRuntime()) {
    const store = await Store.load('settings.json', { autoSave: 250, defaults: {} })
    return (await store.get<T>(key)) ?? null
  }
  try {
    const raw = window.localStorage.getItem(browserSettingsKey)
    if (!raw) return null
    return (JSON.parse(raw) as Record<string, T>)[key] ?? null
  } catch {
    return null
  }
}

export async function writeSetting<T>(key: string, value: T): Promise<void> {
  if (isTauriRuntime()) {
    const store = await Store.load('settings.json', { autoSave: 250, defaults: {} })
    await store.set(key, value)
    await store.save()
    return
  }
  let settings: Record<string, unknown> = {}
  try {
    settings = JSON.parse(window.localStorage.getItem(browserSettingsKey) || '{}') as Record<string, unknown>
  } catch {
    settings = {}
  }
  settings[key] = value
  window.localStorage.setItem(browserSettingsKey, JSON.stringify(settings))
}

export async function deleteSetting(key: string): Promise<void> {
  if (isTauriRuntime()) {
    const store = await Store.load('settings.json', { autoSave: 250, defaults: {} })
    await store.delete(key)
    await store.save()
    return
  }
  try {
    const settings = JSON.parse(window.localStorage.getItem(browserSettingsKey) || '{}') as Record<string, unknown>
    delete settings[key]
    window.localStorage.setItem(browserSettingsKey, JSON.stringify(settings))
  } catch {
    window.localStorage.removeItem(browserSettingsKey)
  }
}

export async function credentialGet(profileId: string): Promise<string | null> {
  if (isTauriRuntime()) {
    return invoke<string | null>('credential_get', { profileId })
  }
  return browserMemoryCredentials.get(profileId) ?? null
}

export async function credentialSet(profileId: string, token: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('credential_set', { profileId, token })
    return
  }
  browserMemoryCredentials.set(profileId, token)
}

export async function credentialDelete(profileId: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('credential_delete', { profileId })
    return
  }
  browserMemoryCredentials.delete(profileId)
}

export async function openExternalUrl(url: string): Promise<void> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' && !(import.meta.env.DEV && parsed.protocol === 'http:' && isLoopback(parsed.hostname))) {
    throw new Error('仅允许打开 HTTPS 地址')
  }
  if (isTauriRuntime()) {
    await invoke('open_external_url', { validatedUrl: parsed.toString() })
    return
  }
  window.open(parsed.toString(), '_blank', 'noopener,noreferrer')
}

export function isLoopback(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}
