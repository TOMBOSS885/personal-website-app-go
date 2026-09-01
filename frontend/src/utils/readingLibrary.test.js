import { beforeEach, describe, expect, it, vi } from 'vitest'
import { estimateArticleReading, getArticlePosition, getReadingLibrary, isArticleFavorite, recordArticleVisit, saveArticlePosition, toggleArticleFavorite } from './readingLibrary'

describe('reading library', () => {
  beforeEach(() => {
    const values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    })
    vi.stubGlobal('window', { dispatchEvent: vi.fn() })
  })

  it('estimates mixed Chinese and English reading time', () => {
    const result = estimateArticleReading(`# 标题\n\n${'内容'.repeat(200)} React component testing`)
    expect(result.wordCount).toBeGreaterThan(400)
    expect(result.minutes).toBeGreaterThanOrEqual(2)
  })

  it('toggles favorites and records unique recent visits', () => {
    const article = { id: 7, title: '示例文章', summary: '摘要' }
    expect(toggleArticleFavorite(article)).toBe(true)
    expect(isArticleFavorite(7)).toBe(true)
    expect(toggleArticleFavorite(article)).toBe(false)
    recordArticleVisit(article)
    recordArticleVisit({ ...article, title: '新标题' })
    expect(getReadingLibrary().history).toHaveLength(1)
    expect(getReadingLibrary().history[0].title).toBe('新标题')
  })

  it('stores only resumable positions', () => {
    saveArticlePosition(3, 0.42)
    expect(getArticlePosition(3)).toBe(0.42)
    saveArticlePosition(3, 1)
    expect(getArticlePosition(3)).toBe(0)
  })

  it('ignores malformed stored reading items', () => {
    localStorage.setItem('personal-blog-reading-library-v1', JSON.stringify({
      favorites: [null, { id: 2 }, { id: 3, title: 'Valid' }],
      history: ['bad', { id: 4, title: 'Recent' }],
    }))
    expect(getReadingLibrary().favorites).toEqual([{ id: 3, title: 'Valid' }])
    expect(getReadingLibrary().history).toEqual([{ id: 4, title: 'Recent' }])
  })
})
