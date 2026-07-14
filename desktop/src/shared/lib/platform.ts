import { invoke } from '@tauri-apps/api/core'

let browserSessionToken: string | null = null

export function safeExternalUrl(raw?: string | null): string | null {
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.toString() : null
  } catch {
    return null
  }
}

export async function openExternalUrl(raw?: string | null): Promise<void> {
  const url = safeExternalUrl(raw)
  if (!url) throw new Error('链接无效或协议不受支持')
  if (window.__TAURI_INTERNALS__) {
    await invoke('open_external_url', { url })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function saveUserToken(serverUrl: string, token: string): Promise<void> {
  if (window.__TAURI_INTERNALS__) {
    await invoke('save_user_token', { serverUrl, token })
  } else {
    browserSessionToken = token
  }
}

export async function loadUserToken(serverUrl: string): Promise<string | null> {
  if (window.__TAURI_INTERNALS__) return invoke<string | null>('load_user_token', { serverUrl })
  return browserSessionToken
}

export async function deleteUserToken(serverUrl: string): Promise<void> {
  if (window.__TAURI_INTERNALS__) {
    await invoke('delete_user_token', { serverUrl })
  } else {
    browserSessionToken = null
  }
}
