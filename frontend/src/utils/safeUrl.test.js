import { describe, expect, it } from 'vitest'
import { safeDownloadHref, safeExternalHref } from './safeUrl'

describe('safeExternalHref', () => {
  it('allows http, https, and mailto URLs', () => {
    expect(safeExternalHref('https://example.com/path')).toBe('https://example.com/path')
    expect(safeExternalHref('mailto:test@example.com')).toBe('mailto:test@example.com')
  })

  it('blocks scriptable URLs', () => {
    expect(safeExternalHref('javascript:alert(1)')).toBe('')
    expect(safeExternalHref('data:text/html,<script>alert(1)</script>')).toBe('')
  })
})

describe('safeDownloadHref', () => {
  it('allows only HTTP and HTTPS download targets', () => {
    expect(safeDownloadHref('https://example.com/client.exe')).toBe('https://example.com/client.exe')
    expect(safeDownloadHref('http://example.com/client.dmg')).toBe('http://example.com/client.dmg')
    expect(safeDownloadHref('mailto:test@example.com')).toBe('')
    expect(safeDownloadHref('javascript:alert(1)')).toBe('')
  })
})
