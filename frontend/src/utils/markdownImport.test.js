import { describe, expect, it } from 'vitest'
import { MAX_MARKDOWN_IMPORT_BYTES, normalizeImportedMarkdown, validateMarkdownImportFile } from './markdownImport'

describe('markdown import validation', () => {
  it('accepts markdown extensions and rejects other files', () => {
    expect(validateMarkdownImportFile({ name: '文章.MD', size: 12 }).valid).toBe(true)
    expect(validateMarkdownImportFile({ name: '文章.txt', size: 12 }).valid).toBe(false)
  })

  it('rejects empty and oversized files before reading', () => {
    expect(validateMarkdownImportFile({ name: 'empty.md', size: 0 }).error).toContain('不能为空')
    expect(validateMarkdownImportFile({ name: 'large.md', size: MAX_MARKDOWN_IMPORT_BYTES + 1 }).error).toContain('5 MB')
  })

  it('normalizes BOM and line endings while rejecting binary content', () => {
    expect(normalizeImportedMarkdown('\uFEFF# 标题\r\n正文\r')).toBe('# 标题\n正文\n')
    expect(() => normalizeImportedMarkdown('标题\u0000内容')).toThrow('二进制')
  })
})
