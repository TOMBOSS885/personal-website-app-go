export const MAX_MARKDOWN_IMPORT_BYTES = 5 * 1024 * 1024

export function validateMarkdownImportFile(file) {
  if (!file || typeof file.name !== 'string') return { valid: false, error: '请选择 Markdown 文件' }
  const name = file.name.trim().toLowerCase()
  if (!name.endsWith('.md') && !name.endsWith('.markdown')) {
    return { valid: false, error: '只支持 .md 或 .markdown 文件' }
  }
  if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0) {
    return { valid: false, error: 'Markdown 文件不能为空' }
  }
  if (Number(file.size) > MAX_MARKDOWN_IMPORT_BYTES) {
    return { valid: false, error: 'Markdown 文件不能超过 5 MB' }
  }
  return { valid: true, error: '' }
}

export function normalizeImportedMarkdown(content) {
  const normalized = String(content ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (normalized.includes('\u0000')) throw new Error('文件包含无效的二进制内容')
  if (normalized.length === 0 || normalized.trim() === '') throw new Error('Markdown 文件不能为空')
  return normalized
}
