import { describe, expect, it } from 'vitest'
import { safeExternalHref } from './safeUrl'

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
