import { describe, expect, it } from 'vitest'
import {
  collectUnreportedTransferBytes,
  formatTransferBytes,
  normalizeSiteMonitor,
} from './siteMonitor'

describe('normalizeSiteMonitor', () => {
  it('accepts safe counters and rejects invalid values', () => {
    expect(normalizeSiteMonitor({
      totalViews: '123',
      totalVisitors: -5,
      estimatedTransferBytes: Number.POSITIVE_INFINITY,
      updatedAt: 123,
    })).toEqual({
      totalViews: 123,
      totalVisitors: 0,
      estimatedTransferBytes: 0,
      updatedAt: '',
    })
  })
})

describe('collectUnreportedTransferBytes', () => {
  it('counts navigation and resources only once', () => {
    const entries = {
      navigation: [{ entryType: 'navigation', name: '/', startTime: 0, transferSize: 800 }],
      resource: [{ entryType: 'resource', name: '/app.js', startTime: 12, transferSize: 1200 }],
    }
    const performanceApi = { getEntriesByType: type => entries[type] || [] }
    const reported = new Set()

    expect(collectUnreportedTransferBytes(performanceApi, reported)).toBe(2000)
    expect(collectUnreportedTransferBytes(performanceApi, reported)).toBe(0)
  })
})

describe('formatTransferBytes', () => {
  it('formats byte totals using binary units', () => {
    expect(formatTransferBytes(1536, 'en')).toBe('1.5 KB')
    expect(formatTransferBytes(0, 'zh')).toBe('0 B')
  })
})
