import { describe, expect, it } from 'vitest'
import { getAdminBasePath, getAdminEntrySuffix, isAdminEntryPath } from './adminEntry'

describe('admin entry paths', () => {
  it('keeps the legacy path available while no private suffix is configured', () => {
    expect(getAdminEntrySuffix('/admin/login')).toBe('admin')
    expect(getAdminBasePath('/admin/articles')).toBe('/admin')
  })

  it('accepts a private single-segment entry and preserves it in generated links', () => {
    expect(getAdminEntrySuffix('/control-k8x4m2q7/theme')).toBe('control-k8x4m2q7')
    expect(getAdminBasePath('/control-k8x4m2q7/theme')).toBe('/control-k8x4m2q7')
    expect(isAdminEntryPath('/control-k8x4m2q7/login')).toBe(true)
  })

  it('does not treat public routes or unsafe segments as an admin entry', () => {
    expect(getAdminEntrySuffix('/blog/1')).toBe('')
    expect(getAdminEntrySuffix('/projects')).toBe('')
    expect(getAdminEntrySuffix('/short')).toBe('')
    expect(getAdminEntrySuffix('/bad/path')).toBe('')
  })
})
