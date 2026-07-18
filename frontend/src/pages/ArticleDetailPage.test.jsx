import { describe, expect, it } from 'vitest'
import { buildToc, buildTocTree, findActiveHeadingIndex } from './ArticleDetailPage'

describe('article table of contents', () => {
  it('builds unique H2-H6 entries and ignores fenced code blocks', () => {
    const items = buildToc(`
## 概览
### 安装
\`\`\`md
## 代码示例中的标题
\`\`\`
#### [配置](https://example.com) ###
## 概览
###### 细节
`)

    expect(items).toEqual([
      { level: 2, text: '概览', id: '概览' },
      { level: 3, text: '安装', id: '安装' },
      { level: 4, text: '配置', id: '配置' },
      { level: 2, text: '概览', id: '概览-2' },
      { level: 6, text: '细节', id: '细节' },
    ])
  })

  it('nests headings under the closest preceding lower level', () => {
    const tree = buildTocTree([
      { level: 2, text: 'A', id: 'a' },
      { level: 3, text: 'A.1', id: 'a-1' },
      { level: 4, text: 'A.1.1', id: 'a-1-1' },
      { level: 2, text: 'B', id: 'b' },
    ])

    expect(tree).toHaveLength(2)
    expect(tree[0].children[0].id).toBe('a-1')
    expect(tree[0].children[0].children[0].id).toBe('a-1-1')
    expect(tree[1].id).toBe('b')
  })

  it('selects the last heading that crossed the reading position', () => {
    const offsets = [320, 760, 1420, 2200]

    expect(findActiveHeadingIndex([], 500)).toBe(-1)
    expect(findActiveHeadingIndex(offsets, 0)).toBe(0)
    expect(findActiveHeadingIndex(offsets, 759)).toBe(0)
    expect(findActiveHeadingIndex(offsets, 760)).toBe(1)
    expect(findActiveHeadingIndex(offsets, 1900)).toBe(2)
    expect(findActiveHeadingIndex(offsets, 9999)).toBe(3)
  })
})
