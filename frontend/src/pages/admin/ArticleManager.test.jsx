import { describe, expect, it } from 'vitest'
import { validateStaticSiteZipSelection } from './ArticleManager'

describe('static frontend ZIP selection', () => {
  it('accepts one ZIP file regardless of extension casing', () => {
    const file = { name: 'campus-site.ZIP' }
    expect(validateStaticSiteZipSelection([file])).toEqual({ file, error: '' })
  })

  it('rejects empty, multiple, and non-ZIP selections', () => {
    expect(validateStaticSiteZipSelection([]).error).toBe('请选择 ZIP 文件')
    expect(validateStaticSiteZipSelection([{ name: 'a.zip' }, { name: 'b.zip' }]).error).toBe('一次只能上传一个 ZIP 文件')
    expect(validateStaticSiteZipSelection([{ name: 'index.html' }]).error).toBe('静态前端必须使用 .zip 压缩包')
  })
})
