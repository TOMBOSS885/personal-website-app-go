import { describe, expect, it } from 'vitest'
import {
  collectUnreportedTransferBytes,
  formatSiteUptime,
  formatTransferBytes,
  normalizeSiteMonitor,
} from './siteMonitor'

describe('normalizeSiteMonitor', () => {
  it('accepts safe counters and rejects invalid values', () => {
    expect(normalizeSiteMonitor({
      totalViews: '123',
      totalVisitors: -5,
      estimatedTransferBytes: Number.POSITIVE_INFINITY,
      startedAt: '2026-08-01T00:00:00+08:00',
      updatedAt: 123,
    })).toEqual({
      totalViews: 123,
      totalVisitors: 0,
      estimatedTransferBytes: 0,
      startedAt: '2026-08-01T00:00:00+08:00',
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

describe('formatSiteUptime', () => {
  it('formats a live day and clock duration', () => {
    const startedAt = '2026-08-01T00:00:00.000Z'
    const now = Date.parse('2026-08-03T01:02:03.000Z')

    expect(formatSiteUptime(startedAt, now, 'zh')).toBe('2天 01:02:03')
    expect(formatSiteUptime(startedAt, now, 'en')).toBe('2d 01:02:03')
  })

  it('rejects missing, invalid, and future start times', () => {
    expect(formatSiteUptime('', Date.now(), 'zh')).toBe('--')
    expect(formatSiteUptime('invalid', Date.now(), 'zh')).toBe('--')
    expect(formatSiteUptime('2027-01-01T00:00:00Z', Date.parse('2026-01-01T00:00:00Z'), 'zh')).toBe('--')
  })
})
