import { describe, expect, it } from 'vitest'
import { normalizePage } from './pagination'

describe('normalizePage', () => {
  it('normalizes an array response', () => {
    const result = normalizePage([{ id: 1 }], 0, 20)
    expect(result.content).toHaveLength(1)
    expect(result.totalElements).toBe(1)
    expect(result.first).toBe(true)
  })

  it('keeps a server page response', () => {
    const result = normalizePage({ content: [1, 2], totalElements: 12, totalPages: 6, size: 2, number: 1 })
    expect(result.totalElements).toBe(12)
    expect(result.last).toBe(false)
  })
})
