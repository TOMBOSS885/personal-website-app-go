import { describe, expect, it } from 'vitest'
import { normalizeSearchText, smartSearch } from './smartSearch'

describe('smartSearch', () => {
  it('normalizes case, full-width characters, and punctuation', () => {
    expect(normalizeSearchText('  React，项目  ')).toBe('react 项目')
  })

  it('matches multiple fields and ranks exact/phrase matches first', () => {
    const items = [
      { name: 'Web 项目', description: 'React 应用' },
      { name: 'React 管理后台', description: '搜索工具' },
      { name: 'React', description: '核心项目' },
      { name: '其他', description: 'Vue 项目' },
    ]
    expect(smartSearch(items, 'React', ['name', 'description']).map(item => item.name)).toEqual(['React', 'Web 项目', 'React 管理后台'])
    expect(smartSearch(items, 'vue', ['name', 'description'])).toHaveLength(1)
  })

  it('returns the original list for an empty query', () => {
    const items = [{ name: 'A' }, { name: 'B' }]
    expect(smartSearch(items, '  ', ['name'])).toBe(items)
  })
})
