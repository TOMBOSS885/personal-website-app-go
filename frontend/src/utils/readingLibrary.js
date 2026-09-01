const STORAGE_KEY = 'personal-blog-reading-library-v1'
const MAX_HISTORY_ITEMS = 80

export function estimateArticleReading(content) {
  const plainText = String(content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~|\-]/g, ' ')

  const hanCount = (plainText.match(/[\u3400-\u9fff]/g) || []).length
  const latinWords = (plainText.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) || []).length
  const wordCount = hanCount + latinWords
  const minutes = Math.max(1, Math.ceil(hanCount / 400 + latinWords / 220))
  return { wordCount, minutes }
}

export function getReadingLibrary() {
  const storage = getStorage()
  if (!storage) return emptyLibrary()
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || 'null')
    return {
      favorites: normalizeItems(parsed?.favorites),
      history: normalizeItems(parsed?.history),
      positions: parsed?.positions && typeof parsed.positions === 'object' ? parsed.positions : {},
    }
  } catch {
    return emptyLibrary()
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return []
  return items.filter(item => item && typeof item === 'object' && item.id != null && String(item.title || '').trim() !== '')
}

export function isArticleFavorite(articleId) {
  const id = String(articleId ?? '')
  return getReadingLibrary().favorites.some(item => String(item.id) === id)
}

export function toggleArticleFavorite(article) {
  const library = getReadingLibrary()
  const id = String(article?.id ?? '')
  const exists = library.favorites.some(item => String(item.id) === id)
  library.favorites = exists
    ? library.favorites.filter(item => String(item.id) !== id)
    : [articleSnapshot(article), ...library.favorites.filter(item => String(item.id) !== id)]
  saveLibrary(library)
  return !exists
}

export function recordArticleVisit(article) {
  if (!article?.id) return
  const library = getReadingLibrary()
  const item = { ...articleSnapshot(article), visitedAt: new Date().toISOString() }
  library.history = [item, ...library.history.filter(entry => String(entry.id) !== String(item.id))]
    .slice(0, MAX_HISTORY_ITEMS)
  saveLibrary(library)
}

export function saveArticlePosition(articleId, progress) {
  const id = String(articleId ?? '')
  if (!id) return
  const library = getReadingLibrary()
  const normalized = Math.max(0, Math.min(1, Number(progress) || 0))
  library.positions[id] = normalized > 0.02 && normalized < 0.98 ? normalized : 0
  saveLibrary(library)
}

export function getArticlePosition(articleId) {
  return Number(getReadingLibrary().positions[String(articleId ?? '')]) || 0
}

function articleSnapshot(article) {
  return {
    id: article?.id,
    title: String(article?.title || ''),
    summary: String(article?.summary || ''),
    coverImage: String(article?.coverImage || ''),
    category: String(article?.category || ''),
    createdAt: article?.createdAt || '',
    updatedAt: article?.updatedAt || '',
  }
}

function saveLibrary(library) {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(library))
    window.dispatchEvent(new CustomEvent('reading-library:updated'))
  } catch {
    // Private browsing and exhausted storage can make localStorage unavailable.
  }
}

function emptyLibrary() {
  return { favorites: [], history: [], positions: {} }
}

function getStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage
}
