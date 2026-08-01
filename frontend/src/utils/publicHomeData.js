const HOME_DATA_MAX_AGE_MS = 10000
const PERSISTED_HOME_DATA_MAX_AGE_MS = 24 * 60 * 60 * 1000
const STORAGE_PREFIX = 'website-home-data-v1-'
const cache = new Map()
let cacheVersion = 0

export function getCachedPublicHomeData(language = 'zh') {
  const key = normalizeLanguage(language)
  const current = cache.get(key)
  if (current?.data) return current.data

  const stored = readPersistedHomeData(key)
  if (!stored) return null
  cache.set(key, { data: stored.data, fetchedAt: stored.fetchedAt, promise: null })
  return stored.data
}

export function fetchPublicHomeData(language = 'zh') {
  const key = normalizeLanguage(language)
  const now = Date.now()
  getCachedPublicHomeData(key)
  const current = cache.get(key)
  const requestVersion = cacheVersion

  if (current?.promise) return current.promise
  if (current?.data && now - current.fetchedAt < HOME_DATA_MAX_AGE_MS) {
    return Promise.resolve(current.data)
  }

  const promise = fetch(`/api/public/home?lang=${key}`)
    .then(response => {
      if (!response.ok) throw new Error('Home data request failed')
      return response.json()
    })
    .then(data => {
      if (requestVersion === cacheVersion) {
        const fetchedAt = Date.now()
        cache.set(key, { data, fetchedAt, promise: null })
        persistHomeData(key, data, fetchedAt)
      }
      return data
    })
    .catch(error => {
      if (requestVersion === cacheVersion) {
        if (current?.data) {
          cache.set(key, { data: current.data, fetchedAt: current.fetchedAt, promise: null })
          return current.data
        }
        cache.delete(key)
      }
      throw error
    })

  cache.set(key, { data: current?.data, fetchedAt: current?.fetchedAt || 0, promise })
  return promise
}

export function invalidatePublicHomeData() {
  cacheVersion += 1
  cache.clear()
  removePersistedHomeData('zh')
  removePersistedHomeData('en')
}

function normalizeLanguage(language) {
  return language === 'en' ? 'en' : 'zh'
}

function readPersistedHomeData(key) {
  const storage = getStorage()
  if (!storage) return null
  try {
    const parsed = JSON.parse(storage.getItem(`${STORAGE_PREFIX}${key}`) || 'null')
    if (!parsed?.data || !Number.isFinite(parsed.fetchedAt)) return null
    if (Date.now() - parsed.fetchedAt > PERSISTED_HOME_DATA_MAX_AGE_MS) {
      storage.removeItem(`${STORAGE_PREFIX}${key}`)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function persistHomeData(key, data, fetchedAt) {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify({ data, fetchedAt }))
  } catch {
    // Storage can be unavailable in private mode or when quota is exhausted.
  }
}

function removePersistedHomeData(key) {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(`${STORAGE_PREFIX}${key}`)
  } catch {
    // Ignore unavailable browser storage.
  }
}

function getStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage
}
