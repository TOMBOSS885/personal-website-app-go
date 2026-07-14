import Database from '@tauri-apps/plugin-sql'
import { isTauriRuntime } from '@shared/lib/platform'
import type { ArticleFormValue } from './types'

export interface ArticleDraft {
  key: string
  payload: ArticleFormValue
  localUpdatedAt: string
  baseRemoteUpdatedAt?: string
}

const prefix = 'personal-website-studio:draft:'
let databasePromise: Promise<Database> | null = null

export async function loadArticleDraft(key: string): Promise<ArticleDraft | null> {
  if (!isTauriRuntime()) {
    try {
      const raw = window.localStorage.getItem(prefix + key)
      return raw ? JSON.parse(raw) as ArticleDraft : null
    } catch {
      return null
    }
  }
  const db = await getDatabase()
  const rows = await db.select<Array<{ payload_json: string; local_updated_at: string; base_remote_updated_at: string | null }>>(
    'SELECT payload_json, local_updated_at, base_remote_updated_at FROM local_drafts WHERE id = $1 LIMIT 1',
    [key],
  )
  const row = rows[0]
  if (!row) return null
  try {
    return { key, payload: JSON.parse(row.payload_json) as ArticleFormValue, localUpdatedAt: row.local_updated_at, baseRemoteUpdatedAt: row.base_remote_updated_at || undefined }
  } catch {
    return null
  }
}

export async function saveArticleDraft(key: string, payload: ArticleFormValue, remoteId?: number, baseRemoteUpdatedAt?: string): Promise<ArticleDraft> {
  const draft: ArticleDraft = { key, payload, localUpdatedAt: new Date().toISOString(), baseRemoteUpdatedAt }
  if (!isTauriRuntime()) {
    window.localStorage.setItem(prefix + key, JSON.stringify(draft))
    return draft
  }
  const db = await getDatabase()
  await db.execute(
    `INSERT INTO local_drafts (id, server_profile_id, remote_type, remote_id, title, payload_json, base_remote_updated_at, local_updated_at, sync_state)
     VALUES ($1, 'primary', 'article', $2, $3, $4, $5, $6, 'local')
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, payload_json=excluded.payload_json, base_remote_updated_at=excluded.base_remote_updated_at, local_updated_at=excluded.local_updated_at, sync_state='local'`,
    [key, remoteId?.toString() || null, payload.title, JSON.stringify(payload), baseRemoteUpdatedAt || null, draft.localUpdatedAt],
  )
  return draft
}

export async function deleteArticleDraft(key: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.localStorage.removeItem(prefix + key)
    return
  }
  const db = await getDatabase()
  await db.execute('DELETE FROM local_drafts WHERE id = $1', [key])
}

async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = Database.load('sqlite:studio.db').then(async (db) => {
      await db.execute(`CREATE TABLE IF NOT EXISTS local_drafts (
        id TEXT PRIMARY KEY,
        server_profile_id TEXT NOT NULL,
        remote_type TEXT NOT NULL,
        remote_id TEXT,
        title TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL,
        base_remote_version TEXT,
        base_remote_updated_at TEXT,
        local_updated_at TEXT NOT NULL,
        sync_state TEXT NOT NULL,
        last_error TEXT
      )`)
      await db.execute('CREATE INDEX IF NOT EXISTS idx_local_drafts_profile_updated ON local_drafts(server_profile_id, local_updated_at DESC)')
      return db
    })
  }
  return databasePromise
}
