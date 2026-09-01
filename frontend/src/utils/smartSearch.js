const SEARCH_SEPARATORS = /[\s,，、;；|/\\:_：。.!！?？()[\]{}<>《》"'“”‘’`~·+-]+/g

export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(SEARCH_SEPARATORS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreSearchMatch(text, query) {
  const normalizedText = normalizeSearchText(text)
  if (!normalizedText || !query) return 0
  if (normalizedText === query) return 1000
  if (normalizedText.startsWith(query)) return 700
  if (normalizedText.includes(query)) return 500

  const tokens = query.split(' ').filter(Boolean)
  let score = 0
  for (const token of tokens) {
    if (normalizedText === token) score += 220
    else if (normalizedText.startsWith(token)) score += 150
    else if (normalizedText.includes(token)) score += 100
    else {
      let cursor = 0
      for (const character of token) {
        const next = normalizedText.indexOf(character, cursor)
        if (next < 0) return 0
        cursor = next + 1
      }
      score += 35
    }
  }
  return tokens.length > 1 ? score / tokens.length : score
}

export function smartSearch(items, query, fields = []) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return items

  return items
    .map((item, index) => {
      const score = fields.reduce((best, field) => Math.max(best, scoreSearchMatch(item?.[field], normalizedQuery)), 0)
      return { item, index, score }
    })
    .filter(result => result.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(result => result.item)
}
